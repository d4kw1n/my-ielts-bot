import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { t, Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

function getMainMenuButtons(lang: Lang) {
  return [
    [
      Markup.button.callback(lang === 'vi' ? '📋 Kế hoạch hôm nay' : '📋 Today\'s Plan', 'go_today_plan'),
      Markup.button.callback(lang === 'vi' ? '📖 Lộ trình học' : '📖 Study Plan', 'go_plan'),
    ],
    [
      Markup.button.callback('📚 Vocab', 'go_vocab'),
      Markup.button.callback('📖 Read', 'go_read'),
      Markup.button.callback('✍️ Write', 'go_write'),
      Markup.button.callback('🗣️ Speak', 'go_speak'),
    ],
    [
      Markup.button.callback(lang === 'vi' ? '🧪 Test trình độ' : '🧪 Placement', 'go_placement'),
      Markup.button.callback(lang === 'vi' ? '🧠 Ôn tập' : '🧠 Review', 'go_review'),
    ],
    [
      Markup.button.callback(lang === 'vi' ? '📊 Tiến trình' : '📊 Progress', 'go_progress'),
      Markup.button.callback(lang === 'vi' ? '📋 Templates' : '📋 Templates', 'go_template'),
    ],
    [
      Markup.button.callback(lang === 'vi' ? '❓ Trợ giúp' : '❓ Help', 'go_help'),
      Markup.button.callback(lang === 'vi' ? '⚙️ Cài đặt' : '⚙️ Settings', 'go_settings'),
    ]
  ];
}

// Helper: trigger a command as if user typed it
function triggerCommand(bot: any, ctx: Context, command: string) {
  const chatId = ctx.chat!.id;
  const fromUser = ctx.from!;
  // Create a synthetic text message update
  const fakeUpdate = {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: fromUser,
      chat: { id: chatId, type: ctx.chat!.type },
      date: Math.floor(Date.now() / 1000),
      text: command,
      entities: [{ offset: 0, length: command.split(' ')[0].length, type: 'bot_command' as const }]
    }
  };
  // Process the fake update through the bot's middleware
  return bot.handleUpdate(fakeUpdate);
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

    const welcomeMsg = lang === 'vi'
      ? `👋 Chào mừng ${ctx.from!.first_name || 'bạn'} đến với IELTS Buddy! 🎯
      
Tôi là trợ lý ảo đồng hành cùng bạn trên con đường chinh phục IELTS.

💡 Bắt đầu nhanh:
1️⃣ Bấm 📋 Kế hoạch hôm nay để biết hôm nay học gì
2️⃣ Hoặc chọn kỹ năng muốn luyện bên dưới`
      : `👋 Welcome ${ctx.from!.first_name || 'friend'} to IELTS Buddy! 🎯
      
I'm your AI tutor dedicated to helping you achieve your IELTS target.

💡 Quick Start:
1️⃣ Press 📋 Today's Plan to see what to study today
2️⃣ Or select a skill to practice below`;

    await ctx.reply(welcomeMsg, Markup.inlineKeyboard(getMainMenuButtons(lang)));
  });

  // Main menu action
  bot.action('main_menu', async (ctx: Context) => {
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    const msg = lang === 'vi' ? '🏠 MENU CHÍNH\nChọn tính năng:' : '🏠 MAIN MENU\nChoose a feature:';
    await ctx.editMessageText(msg, Markup.inlineKeyboard(getMainMenuButtons(lang))).catch(() => {});
  });

  // Command triggers — each button EXECUTES the real command via handleUpdate
  const commandMap: Record<string, string> = {
    'go_today_plan': '/today_plan',
    'go_plan': '/plan',
    'go_vocab': '/vocab',
    'go_read': '/read',
    'go_write': '/write',
    'go_speak': '/speak',
    'go_placement': '/placement',
    'go_review': '/review',
    'go_progress': '/progress',
    'go_template': '/template',
    'go_help': '/help',
    'go_settings': '/settings',
  };

  for (const [action, command] of Object.entries(commandMap)) {
    bot.action(action, async (ctx: Context) => {
      await ctx.answerCbQuery();
      triggerCommand(bot, ctx, command);
    });
  }

  // Legacy action handlers (for backward compat with old buttons in chat history)
  const legacyActions: Record<string, string> = {
    'show_plan': '/plan',
    'show_placement': '/placement',
    'show_video': '/video',
    'show_help': '/help',
    'show_settings': '/settings',
    'show_resources': '/resources',
    'show_progress': '/progress',
  };

  for (const [action, command] of Object.entries(legacyActions)) {
    bot.action(action, async (ctx: Context) => {
      await ctx.answerCbQuery();
      triggerCommand(bot, ctx, command);
    });
  }

  bot.action('show_ai', async (ctx: Context) => {
    await ctx.answerCbQuery();
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.reply(lang === 'vi' 
      ? '🤖 Gửi câu hỏi cho AI bằng cách gõ:\n/ask <câu hỏi của bạn>\n\nVí dụ: /ask Cách cải thiện Reading True/False/Not Given' 
      : '🤖 Ask AI by typing:\n/ask <your question>\n\nExample: /ask How to improve True/False/Not Given in Reading');
  });

  // Language settings
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
