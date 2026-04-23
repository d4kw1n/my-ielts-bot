import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { t, Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerStartCommand(bot: any): void {
  bot.command('start', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const username = ctx.from!.username || '';
    const fullName = `${ctx.from!.first_name || ''} ${ctx.from!.last_name || ''}`.trim();

    // Check if user exists
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;

    if (!user) {
      // Create new user
      db.prepare(`
        INSERT INTO users (telegram_id, username, full_name, language)
        VALUES (?, ?, ?, 'vi')
      `).run(telegramId, username, fullName);

      user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
    }

    const lang = getUserLang(telegramId);

    // Welcome message with menu
    const welcomeMsg = lang === 'vi'
      ? `👋 Chào mừng **${ctx.from!.first_name || 'bạn'}** đến với **IELTS Buddy**! 🎯
      
Tôi là trợ lý ảo đồng hành cùng bạn trên con đường chinh phục **IELTS Band 7.0**. 

💡 **Gợi ý để bắt đầu:**
1. Làm bài test xếp lớp với /placement để tôi biết trình độ của bạn.
2. Thiết lập mục tiêu ở phần Cài đặt.
3. Chọn một hành động dưới đây để bắt đầu ngay!`
      : `👋 Welcome **${ctx.from!.first_name || 'friend'}** to **IELTS Buddy**! 🎯
      
I'm your virtual assistant dedicated to helping you achieve **IELTS Band 7.0**.

💡 **Suggestions to get started:**
1. Take the /placement test so I know your current level.
2. Set your target score in Settings.
3. Choose an action below to start!`;

    const menuButtons = [
      [
        Markup.button.callback(lang === 'vi' ? '📖 Lộ trình học' : '📖 Study Plan', 'show_plan'),
        Markup.button.callback(lang === 'vi' ? '📊 Tiến trình' : '📊 Progress', 'show_progress')
      ],
      [
        Markup.button.callback(lang === 'vi' ? '🧪 Đánh giá trình độ' : '🧪 Placement Test', 'show_placement'),
        Markup.button.callback(lang === 'vi' ? '📺 Video luyện nghe' : '📺 Video Practice', 'show_video')
      ],
      [
        Markup.button.callback(lang === 'vi' ? '🧠 AI Tư vấn' : '🧠 Ask AI', 'show_ai'),
        Markup.button.callback(lang === 'vi' ? '📚 Tài liệu' : '📚 Resources', 'show_resources')
      ],
      [
        Markup.button.callback(lang === 'vi' ? '❓ Trợ giúp (Lệnh)' : '❓ Help (Commands)', 'show_help'),
        Markup.button.callback(lang === 'vi' ? '⚙️ Cài đặt' : '⚙️ Settings', 'show_settings')
      ]
    ];

    await ctx.reply(welcomeMsg, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(menuButtons)
    });
  });

  // Action handlers for the Main Menu buttons - execute commands directly
  bot.action('main_menu', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    
    const menuButtons = [
      [
        Markup.button.callback(lang === 'vi' ? '📖 Lộ trình học' : '📖 Study Plan', 'show_plan'),
        Markup.button.callback(lang === 'vi' ? '📊 Tiến trình' : '📊 Progress', 'show_progress')
      ],
      [
        Markup.button.callback(lang === 'vi' ? '🧪 Đánh giá trình độ' : '🧪 Placement Test', 'show_placement'),
        Markup.button.callback(lang === 'vi' ? '📺 Video luyện nghe' : '📺 Video Practice', 'show_video')
      ],
      [
        Markup.button.callback(lang === 'vi' ? '🧠 AI Tư vấn' : '🧠 Ask AI', 'show_ai'),
        Markup.button.callback(lang === 'vi' ? '📚 Tài liệu' : '📚 Resources', 'show_resources')
      ],
      [
        Markup.button.callback(lang === 'vi' ? '❓ Trợ giúp (Lệnh)' : '❓ Help (Commands)', 'show_help'),
        Markup.button.callback(lang === 'vi' ? '⚙️ Cài đặt' : '⚙️ Settings', 'show_settings')
      ]
    ];

    const msg = lang === 'vi' ? '🏠 **MENU CHÍNH**\nChọn tính năng bạn muốn sử dụng:' : '🏠 **MAIN MENU**\nChoose a feature to use:';
    await ctx.editMessageText(msg, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(menuButtons)
    }).catch(() => {});
  });

  // Direct execution handlers - these simulate the actual command
  bot.action('show_plan', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await ctx.reply('/plan');
  });

  bot.action('show_placement', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await ctx.reply('/placement');
  });

  bot.action('show_video', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await ctx.reply('/video');
  });

  bot.action('show_ai', async (ctx: Context) => {
    await ctx.answerCbQuery();
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.reply(lang === 'vi' 
      ? '🤖 Gửi câu hỏi cho AI bằng cách gõ:\n`/ask <câu hỏi của bạn>`\n\nVí dụ: `/ask Cách cải thiện Reading True/False/Not Given`' 
      : '🤖 Ask AI by typing:\n`/ask <your question>`\n\nExample: `/ask How to improve True/False/Not Given in Reading`',
      { parse_mode: 'Markdown' });
  });

  bot.action('show_help', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await ctx.reply('/help');
  });

  bot.action('show_settings', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await ctx.reply('/settings');
  });

  bot.action('set_lang_vi', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    db.prepare('UPDATE users SET language = ? WHERE telegram_id = ?').run('vi', telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(t('language_set', 'vi'));
  });

  bot.action('set_lang_en', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    db.prepare('UPDATE users SET language = ? WHERE telegram_id = ?').run('en', telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(t('language_set', 'en'));
  });
}
