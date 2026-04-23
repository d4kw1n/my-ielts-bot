import { Context } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { progressBar, bandToPercentage, getSkillEmoji, getPhaseInfo, formatDuration } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerProgressCommand(bot: any): void {
  bot.command('progress', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) {
      await ctx.reply(lang === 'vi' ? '❌ Dùng /start trước.' : '❌ Use /start first.');
      return;
    }

    const target = user.target_score || 7.0;
    const phaseInfo = getPhaseInfo(user.current_phase || 1);

    // Get latest score
    const latestScore = db.prepare(`
      SELECT * FROM test_scores WHERE user_id = ? ORDER BY test_date DESC LIMIT 1
    `).get(user.id) as any;

    // Get previous score for trend
    const prevScore = db.prepare(`
      SELECT * FROM test_scores WHERE user_id = ? ORDER BY test_date DESC LIMIT 1 OFFSET 1
    `).get(user.id) as any;

    // Get total study stats
    const totalStudy = db.prepare(`
      SELECT SUM(duration_minutes) as total, COUNT(DISTINCT log_date) as days
      FROM study_logs WHERE user_id = ?
    `).get(user.id) as any;

    // Get this week's study
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStudy = db.prepare(`
      SELECT SUM(duration_minutes) as total FROM study_logs
      WHERE user_id = ? AND log_date >= ?
    `).get(user.id, weekAgo.toISOString().split('T')[0]) as any;

    // Get test count
    const testCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM test_scores WHERE user_id = ?
    `).get(user.id) as any;

    const title = lang === 'vi' ? '📊 BÁO CÁO TIẾN TRÌNH IELTS' : '📊 IELTS PROGRESS REPORT';

    let msg = `${title}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎯 ${lang === 'vi' ? 'Mục tiêu' : 'Target'}: ${target} | `;
    msg += `📍 ${lang === 'vi' ? phaseInfo.nameVi : phaseInfo.name}\n`;
    if (user.target_date) {
      const daysLeft = Math.ceil((new Date(user.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      msg += `⏰ ${lang === 'vi' ? `Còn ${daysLeft} ngày` : `${daysLeft} days left`}\n`;
    }
    msg += '\n';

    if (latestScore) {
      msg += `📈 ${lang === 'vi' ? 'Điểm gần nhất' : 'Latest Scores'} (${latestScore.test_date}):\n`;

      const skills = [
        { key: 'listening', label: 'Listening', score: latestScore.listening },
        { key: 'reading', label: 'Reading', score: latestScore.reading },
        { key: 'writing', label: 'Writing', score: latestScore.writing },
        { key: 'speaking', label: 'Speaking', score: latestScore.speaking },
      ];

      for (const skill of skills) {
        const emoji = getSkillEmoji(skill.key);
        const pct = bandToPercentage(skill.score, target);
        const bar = progressBar(skill.score, target);
        const trend = prevScore
          ? ` ${skill.score >= (prevScore as any)[skill.key] ? '↑' : '↓'}${Math.abs(skill.score - (prevScore as any)[skill.key]).toFixed(1)}`
          : '';
        msg += `  ${emoji} ${skill.label.padEnd(10)} ${skill.score.toFixed(1)} ${bar}${trend}\n`;
      }

      msg += `  📊 ${'Overall'.padEnd(10)} ${latestScore.overall.toFixed(1)} ${progressBar(latestScore.overall, target)}`;

      if (prevScore) {
        const diff = (latestScore.overall - prevScore.overall).toFixed(1);
        msg += ` ${parseFloat(diff) >= 0 ? '↑' : '↓'}${diff}`;
      }
      msg += '\n';

      // Weakest skill
      const weakest = skills.reduce((min, s) => s.score < min.score ? s : min);
      msg += `\n💡 ${lang === 'vi' ? 'Cần cải thiện nhất' : 'Needs most improvement'}: ${getSkillEmoji(weakest.key)} ${weakest.label} (${weakest.score})\n`;
    } else {
      msg += lang === 'vi'
        ? '❌ Chưa có điểm. Dùng /score hoặc /placement\n'
        : '❌ No scores yet. Use /score or /placement\n';
    }

    msg += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
    msg += `📚 ${lang === 'vi' ? 'THỐNG KÊ HỌC TẬP' : 'STUDY STATS'}\n\n`;
    msg += `📅 ${lang === 'vi' ? 'Tổng ngày học' : 'Total days'}: ${totalStudy?.days || 0}\n`;
    msg += `⏱️ ${lang === 'vi' ? 'Tổng thời gian' : 'Total time'}: ${formatDuration(totalStudy?.total || 0)}\n`;
    msg += `📊 ${lang === 'vi' ? 'Tuần này' : 'This week'}: ${formatDuration(weekStudy?.total || 0)}\n`;
    msg += `🔥 Streak: ${user.study_streak || 0} ${lang === 'vi' ? 'ngày' : 'days'}\n`;
    msg += `📝 ${lang === 'vi' ? 'Số bài test' : 'Tests taken'}: ${testCount?.cnt || 0}\n`;

    await ctx.reply(msg);
  });

  bot.action('show_progress', async (ctx: Context) => {
    await ctx.answerCbQuery();
    // Trigger progress command
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    await ctx.reply(lang === 'vi' ? '📊 Dùng /progress để xem báo cáo đầy đủ.' : '📊 Use /progress for full report.');
  });
}
