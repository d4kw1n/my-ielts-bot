import { Context } from 'telegraf';
import db from '../database/db';
import { t, Lang } from '../utils/i18n';
import { getSkillEmoji, formatDuration } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

const VALID_SKILLS = ['listening', 'reading', 'writing', 'speaking', 'vocabulary', 'grammar'];

export function registerLogCommand(bot: any): void {
  bot.command('log', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const text = (ctx.message as any)?.text || '';
    const parts = text.split(/\s+/).slice(1); // Remove /log

    if (parts.length < 2) {
      await ctx.reply(t('log_usage', lang));
      return;
    }

    const skill = parts[0].toLowerCase();
    const minutes = parseInt(parts[1], 10);
    const notes = parts.slice(2).join(' ') || null;

    if (!VALID_SKILLS.includes(skill)) {
      const validList = VALID_SKILLS.map(s => `${getSkillEmoji(s)} ${s}`).join('\n');
      await ctx.reply(lang === 'vi'
        ? `❌ Kỹ năng không hợp lệ. Chọn một trong:\n\n${validList}`
        : `❌ Invalid skill. Choose one of:\n\n${validList}`
      );
      return;
    }

    if (isNaN(minutes) || minutes <= 0 || minutes > 720) {
      await ctx.reply(lang === 'vi'
        ? '❌ Thời gian không hợp lệ. Nhập số phút (1-720).'
        : '❌ Invalid duration. Enter minutes (1-720).'
      );
      return;
    }

    // Get user ID
    const user = db.prepare('SELECT id, study_streak, last_study_date FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) {
      await ctx.reply(lang === 'vi' ? '❌ Dùng /start trước.' : '❌ Use /start first.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Insert study log
    db.prepare(`
      INSERT INTO study_logs (user_id, log_date, skill, duration_minutes, activity, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, today, skill, minutes, skill, notes);

    // Update streak
    let newStreak = user.study_streak || 0;
    if (user.last_study_date !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (user.last_study_date === yesterdayStr) {
        newStreak += 1;
      } else if (user.last_study_date !== today) {
        newStreak = 1; // Reset streak
      }
    }

    db.prepare(`
      UPDATE users SET study_streak = ?, last_study_date = ?, updated_at = datetime('now')
      WHERE telegram_id = ?
    `).run(newStreak, today, telegramId);

    // Get today's total
    const todayTotal = db.prepare(`
      SELECT SUM(duration_minutes) as total FROM study_logs
      WHERE user_id = ? AND log_date = ?
    `).get(user.id, today) as any;

    const emoji = getSkillEmoji(skill);
    const streakMsg = newStreak > 1 ? `\n🔥 Streak: ${newStreak} ${lang === 'vi' ? 'ngày' : 'days'}!` : '';

    const successMsg = lang === 'vi'
      ? `✅ Đã ghi nhận!

${emoji} ${skill.charAt(0).toUpperCase() + skill.slice(1)}: ${formatDuration(minutes)}
${notes ? `📝 ${notes}\n` : ''}
📊 Tổng hôm nay: ${formatDuration(todayTotal.total || minutes)}${streakMsg}

💪 ${todayTotal.total >= 60 ? 'Tuyệt vời! Bạn đã đạt mục tiêu hôm nay!' : `Còn ${Math.max(0, 60 - (todayTotal.total || 0))} phút nữa để đạt mục tiêu 1h/ngày`}`
      : `✅ Logged!

${emoji} ${skill.charAt(0).toUpperCase() + skill.slice(1)}: ${formatDuration(minutes)}
${notes ? `📝 ${notes}\n` : ''}
📊 Today's total: ${formatDuration(todayTotal.total || minutes)}${streakMsg}

💪 ${todayTotal.total >= 60 ? 'Awesome! You reached today\'s goal!' : `${Math.max(0, 60 - (todayTotal.total || 0))} more minutes to reach 1h/day goal`}`;

    await ctx.reply(successMsg);
  });

  // Today's summary
  bot.command('today', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const user = db.prepare('SELECT id, study_streak FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) {
      await ctx.reply(lang === 'vi' ? '❌ Dùng /start trước.' : '❌ Use /start first.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const logs = db.prepare(`
      SELECT skill, SUM(duration_minutes) as total, GROUP_CONCAT(notes, '; ') as all_notes
      FROM study_logs WHERE user_id = ? AND log_date = ?
      GROUP BY skill
    `).all(user.id, today) as any[];

    if (logs.length === 0) {
      await ctx.reply(lang === 'vi'
        ? '📊 Hôm nay bạn chưa học gì. Dùng /log để bắt đầu!'
        : '📊 No study logged today. Use /log to get started!'
      );
      return;
    }

    const totalMinutes = logs.reduce((sum: number, l: any) => sum + l.total, 0);
    const title = lang === 'vi' ? '📊 TỔNG KẾT HÔM NAY' : '📊 TODAY\'S SUMMARY';

    let msg = `${title}\n━━━━━━━━━━━━━━━━━━━━━━\n📅 ${today}\n\n`;

    for (const log of logs) {
      msg += `${getSkillEmoji(log.skill)} ${log.skill.charAt(0).toUpperCase() + log.skill.slice(1)}: ${formatDuration(log.total)}\n`;
    }

    msg += `\n⏱️ ${lang === 'vi' ? 'Tổng' : 'Total'}: ${formatDuration(totalMinutes)}`;
    msg += `\n🔥 Streak: ${user.study_streak || 0} ${lang === 'vi' ? 'ngày' : 'days'}`;
    msg += `\n${totalMinutes >= 60 ? '✅' : '⚠️'} ${lang === 'vi' ? `${totalMinutes >= 60 ? 'Đạt' : 'Chưa đạt'} mục tiêu 1h/ngày` : `${totalMinutes >= 60 ? 'Met' : 'Not met'} 1h/day goal`}`;

    await ctx.reply(msg);
  });

  // Weekly summary
  bot.command('week', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) return;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const logs = db.prepare(`
      SELECT skill, SUM(duration_minutes) as total
      FROM study_logs WHERE user_id = ? AND log_date >= ?
      GROUP BY skill ORDER BY total DESC
    `).all(user.id, weekAgoStr) as any[];

    const dailyLogs = db.prepare(`
      SELECT log_date, SUM(duration_minutes) as total
      FROM study_logs WHERE user_id = ? AND log_date >= ?
      GROUP BY log_date ORDER BY log_date
    `).all(user.id, weekAgoStr) as any[];

    const totalMinutes = logs.reduce((sum: number, l: any) => sum + l.total, 0);
    const daysStudied = dailyLogs.length;

    const title = lang === 'vi' ? '📊 BÁO CÁO TUẦN' : '📊 WEEKLY REPORT';

    let msg = `${title}\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (logs.length === 0) {
      msg += lang === 'vi' ? '📭 Tuần này chưa có hoạt động nào.' : '📭 No activity this week.';
    } else {
      msg += `📅 ${lang === 'vi' ? 'Số ngày học' : 'Days studied'}: ${daysStudied}/7\n`;
      msg += `⏱️ ${lang === 'vi' ? 'Tổng thời gian' : 'Total time'}: ${formatDuration(totalMinutes)}\n`;
      msg += `📈 ${lang === 'vi' ? 'Trung bình/ngày' : 'Avg/day'}: ${formatDuration(Math.round(totalMinutes / 7))}\n\n`;

      msg += lang === 'vi' ? '📊 Phân bổ theo kỹ năng:\n' : '📊 By skill:\n';
      for (const log of logs) {
        const pct = Math.round((log.total / totalMinutes) * 100);
        msg += `${getSkillEmoji(log.skill)} ${log.skill}: ${formatDuration(log.total)} (${pct}%)\n`;
      }

      // Daily breakdown
      msg += `\n📅 ${lang === 'vi' ? 'Theo ngày' : 'Daily'}:\n`;
      for (const day of dailyLogs) {
        const bar = '█'.repeat(Math.min(Math.round(day.total / 15), 10));
        msg += `${day.log_date.slice(5)}: ${bar} ${formatDuration(day.total)}\n`;
      }
    }

    await ctx.reply(msg);
  });
}
