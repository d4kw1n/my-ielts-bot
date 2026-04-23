import { Telegraf } from 'telegraf';
import { config } from './config';
import { initializeDatabase } from './database/schema';
import { registerStartCommand } from './commands/start';
import { registerPlanCommand } from './commands/plan';
import { registerResourcesCommand } from './commands/resources';
import { registerLogCommand } from './commands/log';
import { registerScoreCommand } from './commands/score';
import { registerProgressCommand } from './commands/progress';
import { registerPlacementCommand } from './commands/placement';
import { registerQuizCommand } from './commands/quiz';
import { registerScheduleCommand } from './commands/schedule';
import { registerSettingsCommand } from './commands/settings';
import { registerAiCommand } from './commands/ai';
import { registerVideoCommand } from './commands/video';
import { registerHelpCommand } from './commands/help';
import { registerImportCommand } from './commands/import';
import { registerBackupCommand } from './commands/backup';
import { registerDailyCommands } from './commands/daily';
import { registerWriteCommand } from './commands/write';
import { registerSpeakCommand } from './commands/speak';
import { registerReadCommand } from './commands/read';
import { registerWeaknessCommand } from './commands/weakness';
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
  registerResourcesCommand(bot);
  registerLogCommand(bot);
  registerScoreCommand(bot);
  registerProgressCommand(bot);
  registerPlacementCommand(bot);
  registerQuizCommand(bot);
  registerScheduleCommand(bot);
  registerSettingsCommand(bot);
  registerAiCommand(bot);
  registerVideoCommand(bot);
  registerHelpCommand(bot);
  registerImportCommand(bot);
  registerBackupCommand(bot);
  registerWriteCommand(bot);  // Must be before registerDailyCommands to handle text messages
  registerDailyCommands(bot);
  registerSpeakCommand(bot);
  registerReadCommand(bot);
  registerWeaknessCommand(bot);

  // Setup telegram native command menu
  bot.telegram.setMyCommands([
    { command: 'start', description: '🏠 Mở Menu chính / Restart' },
    { command: 'help', description: '❓ Xem danh sách toàn bộ lệnh' },
    { command: 'plan', description: '📖 Xem lộ trình học IELTS' },
    { command: 'vocab', description: '📚 Học 1 từ vựng IELTS mỗi ngày' },
    { command: 'grammar', description: '📝 Học 1 cấu trúc ngữ pháp' },
    { command: 'phrase', description: '💬 Học 1 cụm từ / thành ngữ' },
    { command: 'review', description: '🧠 Ôn tập kiến thức đã học hôm nay' },
    { command: 'placement', description: '🧪 Làm bài test đánh giá trình độ' },
    { command: 'log', description: '⏱️ Ghi nhận thời gian học (VD: /log listening 30)' },
    { command: 'today', description: '📅 Báo cáo học tập hôm nay' },
    { command: 'streak', description: '🔥 Xem chuỗi kỷ luật hiện tại' },
    { command: 'score', description: '📝 Nhập điểm thi thử' },
    { command: 'progress', description: '📊 Xem biểu đồ tiến trình' },
    { command: 'video', description: '📺 AI gợi ý video luyện nghe' },
    { command: 'ask', description: '🧠 Hỏi AI bất kỳ thứ gì về IELTS' },
    { command: 'quiz', description: '🎲 Chơi game quiz từ vựng' },
    { command: 'import', description: '📥 Bóc tách câu hỏi từ URL/Văn bản' },
    { command: 'resources', description: '📚 Kho tài liệu Sách & Web' },
    { command: 'backup', description: '☁️ Sao lưu dữ liệu lên Notion' },
    { command: 'schedule', description: '🗓️ Lên lịch thi thử' },
    { command: 'write', description: '✍️ Luyện viết Task 2 có AI chấm điểm' },
    { command: 'speak', description: '🗣️ Luyện nói Speaking Part 1/2/3' },
    { command: 'read', description: '📖 Luyện đọc hiểu Reading' },
    { command: 'weakness', description: '🧠 Phân tích điểm yếu cá nhân' },
    { command: 'settings', description: '⚙️ Cài đặt mục tiêu, ngôn ngữ' }
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
