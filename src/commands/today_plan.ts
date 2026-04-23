import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { getSkillEmoji, formatDuration } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

interface DailyTask {
  emoji: string;
  title: string;
  titleVi: string;
  command: string;
  minutes: number;
  skill: string;
}

export function registerTodayPlanCommand(bot: any): void {
  bot.command('today_plan', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) { await ctx.reply('/start first'); return; }

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon...

    // Check what user already did today
    const todayLogs = db.prepare('SELECT skill, SUM(duration_minutes) as total FROM study_logs WHERE user_id = ? AND log_date = ? GROUP BY skill')
      .all(user.id, today) as any[];
    const doneSkills = new Set(todayLogs.map((l: any) => l.skill));

    const todayLearned = db.prepare('SELECT COUNT(*) as cnt FROM learned_items WHERE user_id = ? AND learned_date = ?')
      .get(user.id, today) as any;
    const hasLearnedVocab = (todayLearned?.cnt || 0) > 0;

    const todayWriting = db.prepare('SELECT COUNT(*) as cnt FROM writing_submissions WHERE user_id = ? AND date(created_at) = ?')
      .get(user.id, today) as any;
    const hasWrittenEssay = (todayWriting?.cnt || 0) > 0;

    // Find weakest skill from latest scores
    const latestScore = db.prepare('SELECT * FROM test_scores WHERE user_id = ? ORDER BY test_date DESC LIMIT 1').get(user.id) as any;
    let weakestSkill = 'reading';
    if (latestScore) {
      const skills = [
        { skill: 'listening', score: latestScore.listening },
        { skill: 'reading', score: latestScore.reading },
        { skill: 'writing', score: latestScore.writing },
        { skill: 'speaking', score: latestScore.speaking },
      ];
      weakestSkill = skills.reduce((min, s) => s.score < min.score ? s : min).skill;
    }

    // Build personalized daily plan
    const tasks: DailyTask[] = [];

    // Task 1: Always learn vocabulary
    tasks.push({
      emoji: '📚', title: 'Learn 1 new vocabulary word', titleVi: 'Học 1 từ vựng mới',
      command: '/vocab', minutes: 5, skill: 'vocabulary'
    });

    // Task 2: Grammar or Phrase (alternate days)
    if (dayOfWeek % 2 === 0) {
      tasks.push({
        emoji: '📝', title: 'Learn 1 grammar structure', titleVi: 'Học 1 cấu trúc ngữ pháp',
        command: '/grammar', minutes: 5, skill: 'grammar'
      });
    } else {
      tasks.push({
        emoji: '💬', title: 'Learn 1 useful phrase', titleVi: 'Học 1 cụm từ hay',
        command: '/phrase', minutes: 5, skill: 'grammar'
      });
    }

    // Task 3: Focus on weakest skill
    switch (weakestSkill) {
      case 'listening':
        tasks.push({
          emoji: '🎧', title: 'Watch 1 English video (15 min)', titleVi: 'Xem 1 video tiếng Anh (15 phút)',
          command: '/video', minutes: 15, skill: 'listening'
        });
        break;
      case 'reading':
        tasks.push({
          emoji: '📖', title: 'Complete 1 reading passage', titleVi: 'Hoàn thành 1 bài đọc hiểu',
          command: '/read', minutes: 15, skill: 'reading'
        });
        break;
      case 'writing':
        if (dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 5) {
          tasks.push({
            emoji: '✍️', title: 'Write 1 Task 2 essay', titleVi: 'Viết 1 bài essay Task 2',
            command: '/write', minutes: 40, skill: 'writing'
          });
        } else {
          tasks.push({
            emoji: '📋', title: 'Study 1 writing template', titleVi: 'Học 1 mẫu cấu trúc essay',
            command: '/template', minutes: 10, skill: 'writing'
          });
        }
        break;
      case 'speaking':
        tasks.push({
          emoji: '🗣️', title: 'Practice Speaking Part 2', titleVi: 'Luyện Speaking Part 2',
          command: '/speak', minutes: 15, skill: 'speaking'
        });
        break;
    }

    // Task 4: Reading practice (if not already the focus)
    if (weakestSkill !== 'reading') {
      tasks.push({
        emoji: '📖', title: 'Quick reading exercise', titleVi: 'Bài đọc nhanh',
        command: '/read', minutes: 10, skill: 'reading'
      });
    }

    // Task 5: Review at end of day
    tasks.push({
      emoji: '🧠', title: 'End-of-day review quiz', titleVi: 'Ôn tập cuối ngày',
      command: '/review', minutes: 5, skill: 'vocabulary'
    });

    // Calculate totals
    const totalMinutes = tasks.reduce((sum, t) => sum + t.minutes, 0);
    const completedMinutes = todayLogs.reduce((sum: number, l: any) => sum + l.total, 0);

    // Build message
    let msg = lang === 'vi'
      ? `📋 *KẾ HOẠCH HỌC HÔM NAY*\n━━━━━━━━━━━━━━━━━━━━━━\n📅 ${today} | ⏱️ Mục tiêu: ~${totalMinutes} phút\n🔥 Streak: ${user.study_streak || 0} ngày\n${weakestSkill ? `⚡ Ưu tiên: ${getSkillEmoji(weakestSkill)} ${weakestSkill.toUpperCase()}` : ''}\n\n`
      : `📋 *TODAY'S STUDY PLAN*\n━━━━━━━━━━━━━━━━━━━━━━\n📅 ${today} | ⏱️ Target: ~${totalMinutes} min\n🔥 Streak: ${user.study_streak || 0} days\n${weakestSkill ? `⚡ Priority: ${getSkillEmoji(weakestSkill)} ${weakestSkill.toUpperCase()}` : ''}\n\n`;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const isDone = (task.skill === 'vocabulary' && hasLearnedVocab && i === 0) ||
                     (task.skill === 'writing' && hasWrittenEssay && task.command === '/write') ||
                     doneSkills.has(task.skill);
      const checkmark = isDone ? '✅' : '⬜';
      const taskTitle = lang === 'vi' ? task.titleVi : task.title;
      msg += `${checkmark} *${i + 1}.* ${task.emoji} ${taskTitle}\n    ⏱️ ~${task.minutes}m | 👉 \`${task.command}\`\n\n`;
    }

    // Progress bar
    const donePct = totalMinutes > 0 ? Math.min(100, Math.round((completedMinutes / totalMinutes) * 100)) : 0;
    const filled = Math.round(donePct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 ${lang === 'vi' ? 'Tiến độ hôm nay' : "Today's progress"}: ${bar} ${donePct}%\n`;
    msg += `⏱️ ${lang === 'vi' ? 'Đã học' : 'Studied'}: ${formatDuration(completedMinutes)} / ${formatDuration(totalMinutes)}`;

    const buttons = [
      [
        Markup.button.callback(lang === 'vi' ? '📚 Bắt đầu học' : '📚 Start Learning', 'tp_start_vocab'),
        Markup.button.callback(lang === 'vi' ? '📊 Tiến trình' : '📊 Progress', 'show_progress'),
      ]
    ];

    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });

  bot.action('tp_start_vocab', async (ctx: Context) => {
    await ctx.answerCbQuery();
    // Trigger /vocab command via synthetic update
    const fakeUpdate = {
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        from: ctx.from!,
        chat: { id: ctx.chat!.id, type: ctx.chat!.type },
        date: Math.floor(Date.now() / 1000),
        text: '/vocab',
        entities: [{ offset: 0, length: 6, type: 'bot_command' as const }]
      }
    };
    bot.handleUpdate(fakeUpdate);
  });
}
