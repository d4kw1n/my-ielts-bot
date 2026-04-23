import { Context } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { getSkillEmoji } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

// Track mistakes from quizzes and reviews
export function recordMistake(userId: number, type: string, question: string, userAnswer: string, correctAnswer: string): void {
  try {
    db.prepare(`
      INSERT INTO mistake_log (user_id, type, question, user_answer, correct_answer, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(userId, type, question.substring(0, 500), userAnswer.substring(0, 200), correctAnswer.substring(0, 200));
  } catch {
    // Table might not exist yet - silently skip
  }
}

export function registerMistakesCommand(bot: any): void {
  bot.command('mistakes', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) { await ctx.reply('/start first'); return; }

    // Get mistake stats
    let hasTable = true;
    let totalMistakes = 0;
    let mistakesByType: any[] = [];
    let recentMistakes: any[] = [];
    let repeatedWords: any[] = [];

    try {
      totalMistakes = (db.prepare('SELECT COUNT(*) as cnt FROM mistake_log WHERE user_id = ?').get(user.id) as any)?.cnt || 0;
      mistakesByType = db.prepare('SELECT type, COUNT(*) as cnt FROM mistake_log WHERE user_id = ? GROUP BY type ORDER BY cnt DESC').all(user.id) as any[];
      recentMistakes = db.prepare('SELECT * FROM mistake_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(user.id) as any[];
      repeatedWords = db.prepare(`
        SELECT correct_answer, COUNT(*) as cnt FROM mistake_log 
        WHERE user_id = ? GROUP BY correct_answer HAVING cnt >= 2 ORDER BY cnt DESC LIMIT 5
      `).all(user.id) as any[];
    } catch {
      hasTable = false;
    }

    if (!hasTable || totalMistakes === 0) {
      await ctx.reply(lang === 'vi'
        ? '📊 Chưa có dữ liệu lỗi sai. Hãy làm quiz (/quiz), ôn tập (/review), hoặc đọc hiểu (/read) để bắt đầu theo dõi!'
        : '📊 No mistake data yet. Take a quiz (/quiz), review (/review), or read (/read) to start tracking!');
      return;
    }

    let msg = lang === 'vi'
      ? `📊 *PHÂN TÍCH LỖI SAI*\n━━━━━━━━━━━━━━━━━━━━━━\n📝 Tổng lỗi: *${totalMistakes}*\n\n`
      : `📊 *MISTAKE ANALYSIS*\n━━━━━━━━━━━━━━━━━━━━━━\n📝 Total mistakes: *${totalMistakes}*\n\n`;

    // By type
    msg += lang === 'vi' ? '📋 *Theo loại:*\n' : '📋 *By Type:*\n';
    for (const row of mistakesByType) {
      const emoji = row.type === 'vocab' ? '📚' : row.type === 'grammar' ? '📝' : row.type === 'reading' ? '📖' : '📌';
      msg += `  ${emoji} ${row.type}: ${row.cnt} lỗi\n`;
    }

    // Repeated mistakes (most important!)
    if (repeatedWords.length > 0) {
      msg += lang === 'vi'
        ? '\n🔴 *LỖI LẶP LẠI (cần ôn gấp):*\n'
        : '\n🔴 *REPEATED MISTAKES (need review):*\n';
      for (const word of repeatedWords) {
        msg += `  ⚠️ "${word.correct_answer}" — sai ${word.cnt} lần\n`;
      }
    }

    // Recent mistakes
    if (recentMistakes.length > 0) {
      msg += lang === 'vi' ? '\n📝 *5 lỗi gần nhất:*\n' : '\n📝 *Last 5 mistakes:*\n';
      for (const m of recentMistakes) {
        msg += `  ❌ ${m.question.substring(0, 60)}...\n     ${lang === 'vi' ? 'Bạn chọn' : 'You chose'}: "${m.user_answer}" → ${lang === 'vi' ? 'Đáp án' : 'Answer'}: "${m.correct_answer}"\n`;
      }
    }

    // Advice
    msg += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
    if (repeatedWords.length > 0) {
      msg += lang === 'vi'
        ? `💡 *Gợi ý:* Bạn hay sai lặp lại ${repeatedWords.length} từ/kiến thức. Hãy tập trung ôn lại chúng bằng /review!`
        : `💡 *Tip:* You repeatedly miss ${repeatedWords.length} items. Focus on reviewing them with /review!`;
    } else {
      msg += lang === 'vi'
        ? '💡 *Tốt!* Không có lỗi lặp lại. Tiếp tục luyện tập!'
        : '💡 *Good!* No repeated mistakes. Keep practicing!';
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}
