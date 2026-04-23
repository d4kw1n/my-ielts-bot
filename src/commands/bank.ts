import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { getQuestionBankStats, runHarvester } from '../services/harvester';
import { logger } from '../utils/logger';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerBankCommand(bot: any): void {
  // /bank — View question bank statistics
  bot.command('bank', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const stats = getQuestionBankStats();

    let msg = lang === 'vi'
      ? `📦 *KHO CÂU HỎI IELTS*\n━━━━━━━━━━━━━━━━━━━━━━\n📊 Tổng: *${stats.total}* câu hỏi\n\n`
      : `📦 *IELTS QUESTION BANK*\n━━━━━━━━━━━━━━━━━━━━━━\n📊 Total: *${stats.total}* questions\n\n`;

    // By type
    msg += lang === 'vi' ? '📋 *Theo loại:*\n' : '📋 *By Type:*\n';
    for (const [type, count] of Object.entries(stats.byType)) {
      const emoji = type === 'vocabulary' ? '📚' : type === 'grammar' ? '📝' : '📖';
      msg += `  ${emoji} ${type}: ${count}\n`;
    }

    // By topic (top 8)
    msg += lang === 'vi' ? '\n🏷️ *Theo chủ đề (top 8):*\n' : '\n🏷️ *By Topic (top 8):*\n';
    const topTopics = Object.entries(stats.byTopic).slice(0, 8);
    if (topTopics.length > 0) {
      for (const [topic, count] of topTopics) {
        msg += `  • ${topic}: ${count}\n`;
      }
    } else {
      msg += lang === 'vi' ? '  (Chưa có dữ liệu chủ đề)\n' : '  (No topic data yet)\n';
    }

    // By source
    msg += lang === 'vi' ? '\n🔗 *Theo nguồn:*\n' : '\n🔗 *By Source:*\n';
    for (const [source, count] of Object.entries(stats.bySource)) {
      const label = source === 'seed' ? '📁 Seed (built-in)' 
        : source === 'ai_import' ? '🤖 /import'
        : source.startsWith('harvester') ? '🌐 Auto-Harvester'
        : source.startsWith('ai_bulk') ? '🧠 AI Bulk Gen'
        : `📌 ${source}`;
      msg += `  ${label}: ${count}\n`;
    }

    const buttons = [
      [Markup.button.callback(lang === 'vi' ? '🌐 Thu thập ngay' : '🌐 Harvest Now', 'bank_harvest')],
      [Markup.button.callback(lang === 'vi' ? '🧠 Sinh câu hỏi AI' : '🧠 Generate AI Questions', 'bank_generate')],
    ];

    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });

  // Trigger manual harvest
  bot.action('bank_harvest', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    await ctx.answerCbQuery();

    await ctx.reply(lang === 'vi'
      ? '🌐 Đang thu thập câu hỏi từ các nguồn online... (có thể mất 2-5 phút)'
      : '🌐 Harvesting questions from online sources... (may take 2-5 minutes)');

    try {
      const result = await runHarvester();
      await ctx.reply(lang === 'vi'
        ? `✅ *Thu thập hoàn tất!*\n\n📰 Bài viết đã xử lý: ${result.articlesProcessed}\n📝 Câu hỏi mới: ${result.questionsGenerated}\n\nDùng /bank để xem thống kê mới.`
        : `✅ *Harvest complete!*\n\n📰 Articles processed: ${result.articlesProcessed}\n📝 New questions: ${result.questionsGenerated}\n\nUse /bank to see updated stats.`,
        { parse_mode: 'Markdown' });
    } catch (e) {
      logger.error('Manual harvest error:', e);
      await ctx.reply(lang === 'vi' ? '❌ Lỗi khi thu thập. Xem log để biết chi tiết.' : '❌ Harvest error. Check logs for details.');
    }
  });

  // Trigger AI bulk generation
  bot.action('bank_generate', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    await ctx.answerCbQuery();

    const topicButtons = [
      [Markup.button.callback('🌍 Environment', 'bank_gen_environment'), Markup.button.callback('💻 Technology', 'bank_gen_technology')],
      [Markup.button.callback('📚 Education', 'bank_gen_education'), Markup.button.callback('🏥 Health', 'bank_gen_health')],
      [Markup.button.callback('💼 Work', 'bank_gen_work'), Markup.button.callback('👥 Society', 'bank_gen_society')],
      [Markup.button.callback('🧬 Science', 'bank_gen_science'), Markup.button.callback('💰 Economics', 'bank_gen_economics')],
      [Markup.button.callback(lang === 'vi' ? '🎲 Tất cả chủ đề (chậm)' : '🎲 All topics (slow)', 'bank_gen_all')],
    ];

    await ctx.reply(
      lang === 'vi' ? '🧠 Chọn chủ đề để sinh câu hỏi:' : '🧠 Select topic to generate questions:',
      Markup.inlineKeyboard(topicButtons)
    );
  });

  bot.action(/^bank_gen_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const topic = match[1];
    await ctx.answerCbQuery();

    await ctx.editMessageText(lang === 'vi'
      ? `⏳ Đang sinh câu hỏi cho chủ đề *${topic}*...`
      : `⏳ Generating questions for *${topic}*...`,
      { parse_mode: 'Markdown' });

    try {
      if (topic === 'all') {
        // Generate for all topics (this will take a while)
        const result = await runHarvester();
        await ctx.reply(lang === 'vi'
          ? `✅ Hoàn tất! ${result.questionsGenerated} câu hỏi mới được tạo.`
          : `✅ Done! ${result.questionsGenerated} new questions generated.`);
      } else {
        // Generate for specific topic across bands
        const { generateBulkForTopic } = await import('../services/harvester');
        const count = await generateBulkForTopic(topic);
        await ctx.reply(lang === 'vi'
          ? `✅ Đã tạo *${count}* câu hỏi mới cho chủ đề *${topic}*!`
          : `✅ Generated *${count}* new questions for *${topic}*!`,
          { parse_mode: 'Markdown' });
      }
    } catch (e) {
      logger.error('Generation error:', e);
      await ctx.reply(lang === 'vi' ? '❌ Lỗi khi sinh câu hỏi.' : '❌ Error generating questions.');
    }
  });
}
