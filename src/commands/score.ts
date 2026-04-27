import { Context } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { overallBand, getSkillEmoji, getVietnamToday } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerScoreCommand(bot: any): void {
  bot.command('score', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const text = (ctx.message as any)?.text || '';
    const parts = text.split(/\s+/).slice(1);

    if (parts.length < 4) {
      const usage = lang === 'vi'
        ? `📊 Nhập điểm mock test:

/score <Listening> <Reading> <Writing> <Speaking>

Ví dụ:
/score 6.5 6.0 5.5 6.0
/score 7.0 6.5 6.0 6.5 monthly

Loại test: practice (mặc định), monthly, official
Ghi chú thêm sau loại test.`
        : `📊 Enter mock test scores:

/score <Listening> <Reading> <Writing> <Speaking>

Examples:
/score 6.5 6.0 5.5 6.0
/score 7.0 6.5 6.0 6.5 monthly

Test types: practice (default), monthly, official
Add notes after test type.`;
      await ctx.reply(usage);
      return;
    }

    const listening = parseFloat(parts[0]);
    const reading = parseFloat(parts[1]);
    const writing = parseFloat(parts[2]);
    const speaking = parseFloat(parts[3]);
    const testType = parts[4] || 'practice';
    const notes = parts.slice(5).join(' ') || null;

    // Validate scores
    const scores = [listening, reading, writing, speaking];
    for (const s of scores) {
      if (isNaN(s) || s < 0 || s > 9 || (s * 2) % 1 !== 0) {
        await ctx.reply(lang === 'vi'
          ? '❌ Điểm không hợp lệ. Mỗi kỹ năng từ 0-9, bước 0.5 (ví dụ: 5.0, 5.5, 6.0)'
          : '❌ Invalid score. Each skill 0-9, step 0.5 (e.g., 5.0, 5.5, 6.0)'
        );
        return;
      }
    }

    const user = db.prepare('SELECT id, target_score FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) {
      await ctx.reply(lang === 'vi' ? '❌ Dùng /start trước.' : '❌ Use /start first.');
      return;
    }

    const overall = overallBand(listening, reading, writing, speaking);
    const today = getVietnamToday();

    // Save score
    db.prepare(`
      INSERT INTO test_scores (user_id, test_date, test_type, listening, reading, writing, speaking, overall, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, today, testType, listening, reading, writing, speaking, overall, notes);

    // Get previous score for comparison
    const prevScore = db.prepare(`
      SELECT * FROM test_scores WHERE user_id = ? AND id != (SELECT MAX(id) FROM test_scores WHERE user_id = ?)
      ORDER BY id DESC LIMIT 1
    `).get(user.id, user.id) as any;

    const target = user.target_score || 7.0;
    const testTypeLabels: Record<string, string> = { practice: 'Luyện tập', monthly: 'Hàng tháng', official: 'Chính thức' };
    const testTypeLabel = lang === 'vi'
      ? testTypeLabels[testType] || testType
      : testType.charAt(0).toUpperCase() + testType.slice(1);

    let msg = lang === 'vi'
      ? `✅ ĐÃ LƯU ĐIỂM!
━━━━━━━━━━━━━━━━━━━━━━
📅 ${today} | 📋 ${testTypeLabel}
${notes ? `📝 ${notes}\n` : ''}
🎧 Listening:  ${listening}${prevScore ? ` (${listening >= prevScore.listening ? '↑' : '↓'}${Math.abs(listening - prevScore.listening).toFixed(1)})` : ''}
📖 Reading:    ${reading}${prevScore ? ` (${reading >= prevScore.reading ? '↑' : '↓'}${Math.abs(reading - prevScore.reading).toFixed(1)})` : ''}
✍️ Writing:    ${writing}${prevScore ? ` (${writing >= prevScore.writing ? '↑' : '↓'}${Math.abs(writing - prevScore.writing).toFixed(1)})` : ''}
🗣️ Speaking:   ${speaking}${prevScore ? ` (${speaking >= prevScore.speaking ? '↑' : '↓'}${Math.abs(speaking - prevScore.speaking).toFixed(1)})` : ''}
━━━━━━━━━━━━━━━━━━━━━━
📊 Overall:    ${overall} / ${target}
${overall >= target ? '🎉 CHÚC MỪNG! Bạn đã đạt mục tiêu!' : `📈 Còn ${(target - overall).toFixed(1)} band nữa!`}`
      : `✅ SCORE SAVED!
━━━━━━━━━━━━━━━━━━━━━━
📅 ${today} | 📋 ${testTypeLabel}
${notes ? `📝 ${notes}\n` : ''}
🎧 Listening:  ${listening}${prevScore ? ` (${listening >= prevScore.listening ? '↑' : '↓'}${Math.abs(listening - prevScore.listening).toFixed(1)})` : ''}
📖 Reading:    ${reading}${prevScore ? ` (${reading >= prevScore.reading ? '↑' : '↓'}${Math.abs(reading - prevScore.reading).toFixed(1)})` : ''}
✍️ Writing:    ${writing}${prevScore ? ` (${writing >= prevScore.writing ? '↑' : '↓'}${Math.abs(writing - prevScore.writing).toFixed(1)})` : ''}
🗣️ Speaking:   ${speaking}${prevScore ? ` (${speaking >= prevScore.speaking ? '↑' : '↓'}${Math.abs(speaking - prevScore.speaking).toFixed(1)})` : ''}
━━━━━━━━━━━━━━━━━━━━━━
📊 Overall:    ${overall} / ${target}
${overall >= target ? '🎉 CONGRATULATIONS! Target reached!' : `📈 ${(target - overall).toFixed(1)} more bands to go!`}`;

    await ctx.reply(msg);
  });

  // History command
  bot.command('history', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) return;

    const scores = db.prepare(`
      SELECT * FROM test_scores WHERE user_id = ? ORDER BY test_date DESC LIMIT 10
    `).all(user.id) as any[];

    if (scores.length === 0) {
      await ctx.reply(lang === 'vi'
        ? '📊 Chưa có điểm nào. Dùng /score để nhập điểm đầu tiên.'
        : '📊 No scores yet. Use /score to enter your first score.'
      );
      return;
    }

    const title = lang === 'vi' ? '📊 LỊCH SỬ ĐIỂM SỐ' : '📊 SCORE HISTORY';
    let msg = `${title}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const s of scores) {
      const typeLabel = { practice: '📝', monthly: '📅', official: '🏆' }[s.test_type as string] || '📝';
      msg += `${typeLabel} ${s.test_date}\n`;
      msg += `   L:${s.listening} R:${s.reading} W:${s.writing} S:${s.speaking} = ${s.overall}\n`;
      if (s.notes) msg += `   📝 ${s.notes}\n`;
      msg += '\n';
    }

    // Show trend
    if (scores.length >= 2) {
      const latest = scores[0];
      const first = scores[scores.length - 1];
      const diff = (latest.overall - first.overall).toFixed(1);
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📈 ${lang === 'vi' ? 'Thay đổi' : 'Change'}: ${parseFloat(diff) >= 0 ? '+' : ''}${diff} band (${scores.length} ${lang === 'vi' ? 'bài test' : 'tests'})`;
    }

    await ctx.reply(msg);
  });
}
