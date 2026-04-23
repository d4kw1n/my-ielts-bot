import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { getSkillEmoji } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerResourcesCommand(bot: any): void {
  bot.command('resources', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const title = lang === 'vi' ? '📚 TÀI NGUYÊN HỌC TẬP' : '📚 LEARNING RESOURCES';
    const subtitle = lang === 'vi' ? 'Chọn kỹ năng để xem tài liệu:' : 'Select a skill to view resources:';

    await ctx.reply(`${title}\n━━━━━━━━━━━━━━━━━━━━━━\n${subtitle}`, Markup.inlineKeyboard([
      [
        Markup.button.callback('🎧 Listening', 'res_listening'),
        Markup.button.callback('📖 Reading', 'res_reading'),
      ],
      [
        Markup.button.callback('✍️ Writing', 'res_writing'),
        Markup.button.callback('🗣️ Speaking', 'res_speaking'),
      ],
      [
        Markup.button.callback('📚 Vocabulary', 'res_vocabulary'),
        Markup.button.callback('📝 Grammar', 'res_grammar'),
      ],
      [
        Markup.button.callback(lang === 'vi' ? '📕 Sách tổng hợp' : '📕 All-in-One Books', 'res_all'),
      ],
    ]));
  });

  // Handle resource callbacks
  bot.action(/^res_(.+)$/, async (ctx: Context) => {
    const match = (ctx as any).match;
    const skill = match[1];
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const resources = db.prepare(
      'SELECT * FROM resources WHERE skill = ? ORDER BY category, difficulty'
    ).all(skill) as any[];

    if (resources.length === 0) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(lang === 'vi' ? '❌ Chưa có tài liệu cho kỹ năng này.' : '❌ No resources found for this skill.');
      return;
    }

    const emoji = getSkillEmoji(skill);
    const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);

    // Group by category
    const websites = resources.filter(r => r.category === 'website');
    const books = resources.filter(r => r.category === 'book');

    let msg = `${emoji} ${skillName.toUpperCase()} RESOURCES\n━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (websites.length > 0) {
      msg += `\n🌐 ${lang === 'vi' ? 'TRANG WEB' : 'WEBSITES'}:\n\n`;
      for (const r of websites) {
        const desc = lang === 'vi' ? r.description_vi : r.description;
        const free = r.is_free ? '🆓' : '💰';
        msg += `${free} ${r.name}\n`;
        msg += `   ${desc}\n`;
        if (r.url) msg += `   🔗 ${r.url}\n`;
        msg += '\n';
      }
    }

    if (books.length > 0) {
      msg += `📕 ${lang === 'vi' ? 'SÁCH' : 'BOOKS'}:\n\n`;
      for (const r of books) {
        const desc = lang === 'vi' ? r.description_vi : r.description;
        msg += `📖 ${r.name}\n`;
        msg += `   ${desc}\n`;
        msg += '\n';
      }
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━━`;

    await ctx.answerCbQuery();
    await ctx.editMessageText(msg, Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'vi' ? '⬅️ Quay lại' : '⬅️ Back', 'back_to_resources')],
    ]));
  });

  bot.action('back_to_resources', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const title = lang === 'vi' ? '📚 TÀI NGUYÊN HỌC TẬP' : '📚 LEARNING RESOURCES';
    const subtitle = lang === 'vi' ? 'Chọn kỹ năng để xem tài liệu:' : 'Select a skill to view resources:';

    await ctx.answerCbQuery();
    await ctx.editMessageText(`${title}\n━━━━━━━━━━━━━━━━━━━━━━\n${subtitle}`, Markup.inlineKeyboard([
      [
        Markup.button.callback('🎧 Listening', 'res_listening'),
        Markup.button.callback('📖 Reading', 'res_reading'),
      ],
      [
        Markup.button.callback('✍️ Writing', 'res_writing'),
        Markup.button.callback('🗣️ Speaking', 'res_speaking'),
      ],
      [
        Markup.button.callback('📚 Vocabulary', 'res_vocabulary'),
        Markup.button.callback('📝 Grammar', 'res_grammar'),
      ],
      [
        Markup.button.callback(lang === 'vi' ? '📕 Sách tổng hợp' : '📕 All-in-One Books', 'res_all'),
      ],
    ]));
  });

  // Also handle the inline callback from plan
  bot.action('show_resources', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const title = lang === 'vi' ? '📚 TÀI NGUYÊN HỌC TẬP' : '📚 LEARNING RESOURCES';
    const subtitle = lang === 'vi' ? 'Chọn kỹ năng để xem tài liệu:' : 'Select a skill to view resources:';

    await ctx.answerCbQuery();
    await ctx.editMessageText(`${title}\n━━━━━━━━━━━━━━━━━━━━━━\n${subtitle}`, Markup.inlineKeyboard([
      [
        Markup.button.callback('🎧 Listening', 'res_listening'),
        Markup.button.callback('📖 Reading', 'res_reading'),
      ],
      [
        Markup.button.callback('✍️ Writing', 'res_writing'),
        Markup.button.callback('🗣️ Speaking', 'res_speaking'),
      ],
      [
        Markup.button.callback('📚 Vocabulary', 'res_vocabulary'),
        Markup.button.callback('📝 Grammar', 'res_grammar'),
      ],
      [
        Markup.button.callback(lang === 'vi' ? '📕 Sách tổng hợp' : '📕 All-in-One Books', 'res_all'),
      ],
    ]));
  });
}
