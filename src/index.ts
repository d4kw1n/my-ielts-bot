import { Telegraf } from 'telegraf';
import { config } from './config';
import { initializeDatabase } from './database/schema';
import { registerStartCommand } from './commands/start';
import { registerPlanCommand } from './commands/plan';
import { registerLogCommand } from './commands/log';
import { registerScoreCommand } from './commands/score';
import { registerProgressCommand } from './commands/progress';
import { registerPlacementCommand } from './commands/placement';
import { registerQuizCommand } from './commands/quiz';
import { registerScheduleCommand } from './commands/schedule';
import { registerSettingsCommand } from './commands/settings';
import { registerAiCommand } from './commands/ai';
import { registerHelpCommand } from './commands/help';
import { registerImportCommand } from './commands/import';
import { registerBackupCommand } from './commands/backup';
import { registerDailyCommands } from './commands/daily';
import { registerWriteCommand } from './commands/write';
import { registerSpeakCommand } from './commands/speak';
import { registerReadCommand } from './commands/read';
import { registerBankCommand } from './commands/bank';
import { registerTodayPlanCommand } from './commands/today_plan';
import { registerTemplateCommand } from './commands/template';
import { registerMistakesCommand } from './commands/mistakes';
import { setupScheduler } from './services/scheduler';
import { logger } from './utils/logger';

// Override global console
console.log = (...args) => logger.info(args.join(' '));
console.error = (...args) => logger.error(args.join(' '));
console.warn = (...args) => logger.warn(args.join(' '));
console.info = (...args) => logger.info(args.join(' '));

async function main() {
  console.log('🚀 Starting IELTS Study Tracker Bot...');

  // Validate config
  if (!config.botToken) {
    console.error('❌ BOT_TOKEN is required!');
    process.exit(1);
  }

  // Initialize database
  initializeDatabase();

  // Create bot instance
  const bot = new Telegraf(config.botToken.trim());

  // Global logging middleware to capture all events
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const username = ctx.from.username || ctx.from.first_name || 'Unknown';
      let actionType = 'Event';
      let actionDetail = '';

      if (ctx.message && 'text' in ctx.message) {
        actionType = 'Message';
        actionDetail = ctx.message.text;
      } else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        actionType = 'Callback';
        actionDetail = ctx.callbackQuery.data;
      }
      
      if (actionDetail) {
        logger.info(`[${actionType}] From: @${username} (ID: ${ctx.from.id}) | Data: ${actionDetail}`);
      }
    }
    await next();
  });

  // Register all commands
  registerStartCommand(bot);
  registerPlanCommand(bot);
  registerLogCommand(bot);
  registerScoreCommand(bot);
  registerProgressCommand(bot);
  registerPlacementCommand(bot);
  registerQuizCommand(bot);
  registerScheduleCommand(bot);
  registerSettingsCommand(bot);
  registerAiCommand(bot);
  registerHelpCommand(bot);
  registerImportCommand(bot);
  registerBackupCommand(bot);
  registerWriteCommand(bot);  // Must be before registerDailyCommands to handle text messages
  registerDailyCommands(bot);
  registerSpeakCommand(bot);
  registerReadCommand(bot);
  registerBankCommand(bot);
  registerTodayPlanCommand(bot);
  registerTemplateCommand(bot);
  registerMistakesCommand(bot);

  // Setup telegram native command menu (max ~20 core commands)
  bot.telegram.setMyCommands([
    { command: 'start', description: '🏠 Menu chính' },
    { command: 'help', description: '❓ Hướng dẫn sử dụng' },
    { command: 'today_plan', description: '📋 Kế hoạch học hôm nay' },
    { command: 'plan', description: '📖 Lộ trình học IELTS' },
    { command: 'vocab', description: '📚 Học từ vựng mới' },
    { command: 'grammar', description: '📝 Học cấu trúc ngữ pháp' },
    { command: 'phrase', description: '💬 Học cụm từ hay' },
    { command: 'read', description: '📖 Luyện đọc hiểu' },
    { command: 'write', description: '✍️ Luyện viết + AI chấm' },
    { command: 'speak', description: '🗣️ Luyện nói Speaking' },
    { command: 'review', description: '🧠 Ôn tập kiến thức' },
    { command: 'quiz', description: '🎲 Quiz từ vựng' },
    { command: 'placement', description: '🧪 Test đánh giá trình độ' },
    { command: 'log', description: '⏱️ Ghi nhận thời gian học' },
    { command: 'progress', description: '📊 Xem tiến trình' },
    { command: 'mistakes', description: '📊 Phân tích lỗi sai' },
    { command: 'ask', description: '🤖 Hỏi AI về IELTS' },
    { command: 'bank', description: '📦 Kho câu hỏi' },
    { command: 'backup', description: '☁️ Sao lưu dữ liệu' },
    { command: 'settings', description: '⚙️ Cài đặt' },
  ]).catch((err: any) => console.error('Failed to set commands:', err));

  // Setup cron jobs
  setupScheduler(bot);

  // Error handling
  bot.catch((err: any, ctx: any) => {
    console.error(`Error for ${ctx.updateType}:`, err);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Launch bot
  await bot.launch();
  console.log('✅ IELTS Study Tracker Bot is running!');
  console.log(`📋 Bot: @${(await bot.telegram.getMe()).username}`);
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
