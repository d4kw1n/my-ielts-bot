import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import db from '../database/db';

const studySuggestions = {
  vi: [
    '🎧 Nghe 1 bài BBC 6 Minute English + ghi chép từ mới',
    '📖 Đọc 1 passage Cambridge IELTS và làm bài (20 phút)',
    '✍️ Viết 1 Task 2 essay về chủ đề Environment',
    '🗣️ Luyện nói Part 2: Describe a place you have visited',
    '📚 Ôn 20 từ vựng theo chủ đề Education',
    '📝 Luyện grammar: Complex sentences & conditionals',
    '🎧 Nghe TED Talk và tóm tắt nội dung chính',
    '📖 Đọc bài báo The Guardian và highlight từ mới',
    '✍️ Viết 1 Task 1 mô tả biểu đồ/bảng số liệu',
    '🗣️ Luyện nói Part 1: Hobbies, Work, Hometown',
  ],
  en: [
    '🎧 Listen to 1 BBC 6 Minute English + note new words',
    '📖 Read 1 Cambridge IELTS passage (20 minutes)',
    '✍️ Write 1 Task 2 essay on Environment',
    '🗣️ Speaking Part 2: Describe a place you visited',
    '📚 Review 20 vocabulary words on Education topic',
    '📝 Grammar practice: Complex sentences & conditionals',
    '🎧 Watch a TED Talk and summarize key points',
    '📖 Read a Guardian article and highlight new words',
    '✍️ Write 1 Task 1 describing a chart/table',
    '🗣️ Speaking Part 1: Hobbies, Work, Hometown',
  ],
};

export function setupScheduler(bot: Telegraf): void {
  // Daily reminder - check every minute
  cron.schedule('* * * * *', () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const users = db.prepare(
      `SELECT telegram_id, language, daily_reminder_time, study_streak FROM users WHERE reminder_enabled = 1 AND daily_reminder_time = ?`
    ).all(currentTime) as any[];

    for (const user of users) {
      const lang = user.language || 'vi';
      const suggestions = studySuggestions[lang as 'vi' | 'en'];
      const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
      const streak = user.study_streak || 0;

      const streakText = streak > 0 
        ? (lang === 'vi' ? `🔥 Đang giữ chuỗi: ${streak} ngày. Đừng làm đứt chuỗi nhé!` : `🔥 Current streak: ${streak} days. Keep it up!`)
        : (lang === 'vi' ? `🔥 Hãy bắt đầu chuỗi ngày học kỷ luật ngay hôm nay!` : `🔥 Start your disciplined study streak today!`);

      const msg = lang === 'vi'
        ? `⏰ Nhắc nhở học IELTS!\n\n${streakText}\n\nHôm nay bạn đã học chưa? Mục tiêu: 1-2 giờ/ngày\n\n📌 Gợi ý hôm nay:\n${suggestion}\n\nDùng /log để ghi nhận khi học xong! 💪`
        : `⏰ IELTS Study Reminder!\n\n${streakText}\n\nHave you studied today? Target: 1-2 hours/day\n\n📌 Today's suggestion:\n${suggestion}\n\nUse /log to record when done! 💪`;

      bot.telegram.sendMessage(user.telegram_id, msg).catch(err => {
        console.error(`Failed to send reminder to ${user.telegram_id}:`, err.message);
      });
    }
  });

  // Auto-send Vocabulary at 09:00
  cron.schedule('0 9 * * *', async () => {
    const users = db.prepare('SELECT telegram_id FROM users WHERE reminder_enabled = 1').all() as any[];
    const { sendDailyVocab } = await import('../commands/daily');
    for (const user of users) {
      await sendDailyVocab(bot, user.telegram_id, user.telegram_id);
    }
  });

  // Auto-send Grammar/Phrase at 15:00
  cron.schedule('0 15 * * *', async () => {
    const users = db.prepare('SELECT telegram_id FROM users WHERE reminder_enabled = 1').all() as any[];
    const { sendDailyGrammar, sendDailyPhrase } = await import('../commands/daily');
    const isGrammarDay = new Date().getDay() % 2 === 0; // Alternate days
    for (const user of users) {
      if (isGrammarDay) {
        await sendDailyGrammar(bot, user.telegram_id, user.telegram_id);
      } else {
        await sendDailyPhrase(bot, user.telegram_id, user.telegram_id);
      }
    }
  });

  // Auto-send Review at 21:00
  cron.schedule('0 21 * * *', async () => {
    const users = db.prepare('SELECT telegram_id FROM users WHERE reminder_enabled = 1').all() as any[];
    const { sendDailyReview } = await import('../commands/daily');
    for (const user of users) {
      await sendDailyReview(bot, user.telegram_id, user.telegram_id);
    }
  });

  // SRS Spaced Repetition reminder at 12:00
  cron.schedule('0 12 * * *', () => {
    const today = new Date().toISOString().split('T')[0];
    const users = db.prepare('SELECT id, telegram_id, language FROM users WHERE reminder_enabled = 1').all() as any[];

    for (const user of users) {
      const dueItems = db.prepare(
        'SELECT * FROM learned_items WHERE user_id = ? AND next_review_date <= ? AND mastery_level < 5 ORDER BY next_review_date ASC LIMIT 10'
      ).all(user.id, today) as any[];

      if (dueItems.length === 0) continue;

      const lang = user.language || 'vi';
      let msg = lang === 'vi'
        ? `🔄 *ÔN TẬP CÁCH QUÃNG (SRS)*\n━━━━━━━━━━━━━━━━━━━━━━\nBạn có *${dueItems.length}* kiến thức cần ôn lại hôm nay:\n\n`
        : `🔄 *SPACED REPETITION REVIEW*\n━━━━━━━━━━━━━━━━━━━━━━\nYou have *${dueItems.length}* items due for review today:\n\n`;

      for (let i = 0; i < Math.min(dueItems.length, 5); i++) {
        const item = dueItems[i];
        const icon = item.type === 'vocab' ? '🎯' : item.type === 'grammar' ? '📌' : '🔥';
        msg += `${i + 1}. ${icon} *${item.word}*\n   📖 ${item.meaning}\n`;
      }

      if (dueItems.length > 5) {
        msg += lang === 'vi' ? `\n...và ${dueItems.length - 5} kiến thức khác.` : `\n...and ${dueItems.length - 5} more items.`;
      }

      msg += lang === 'vi' ? '\n\n💡 Dùng /review để ôn tập ngay!' : '\n\n💡 Use /review to start reviewing!';

      // Update reviewed items: advance mastery + set next review date
      const srsIntervals = [1, 3, 7, 14, 30]; // days between reviews
      for (const item of dueItems) {
        const newMastery = Math.min((item.mastery_level || 0) + 1, 5);
        const intervalDays = srsIntervals[Math.min(newMastery - 1, srsIntervals.length - 1)];
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + intervalDays);
        const nextReviewStr = nextDate.toISOString().split('T')[0];

        db.prepare('UPDATE learned_items SET mastery_level = ?, next_review_date = ?, review_count = review_count + 1 WHERE id = ?')
          .run(newMastery, nextReviewStr, item.id);
      }

      bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'Markdown' }).catch((err: any) => {
        console.error(`Failed to send SRS reminder to ${user.telegram_id}:`, err.message);
      });
    }
  });

  // Test reminder - check daily at 09:00
  cron.schedule('0 9 * * *', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const tests = db.prepare(`
      SELECT st.*, u.telegram_id, u.language FROM scheduled_tests st
      JOIN users u ON u.id = st.user_id
      WHERE st.test_date = ? AND st.status = 'scheduled'
    `).all(tomorrowStr) as any[];

    for (const test of tests) {
      const lang = test.language || 'vi';
      const msg = lang === 'vi'
        ? `🔔 NHẮC NHỞ: Bài kiểm tra NGÀY MAI!\n\n📅 Ngày: ${test.test_date}\n📋 Loại: Monthly Mock Test\n\n✅ Chuẩn bị:\n• Cambridge IELTS test\n• Môi trường yên tĩnh\n• Đồng hồ bấm giờ\n• Bút chì và giấy\n\n💪 Bạn đã sẵn sàng!`
        : `🔔 REMINDER: Test TOMORROW!\n\n📅 Date: ${test.test_date}\n📋 Type: Monthly Mock Test\n\n✅ Prepare:\n• Cambridge IELTS test\n• Quiet environment\n• Timer\n• Pencil and paper\n\n💪 You've got this!`;

      bot.telegram.sendMessage(test.telegram_id, msg).catch(err => {
        console.error(`Failed to send test reminder:`, err.message);
      });
    }
  });

  // Weekly report - every Sunday at 20:00
  cron.schedule('0 20 * * 0', () => {
    const users = db.prepare('SELECT * FROM users WHERE reminder_enabled = 1').all() as any[];

    for (const user of users) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const totalStudy = db.prepare(
        `SELECT SUM(duration_minutes) as total, COUNT(DISTINCT log_date) as days FROM study_logs WHERE user_id = ? AND log_date >= ?`
      ).get(user.id, weekAgoStr) as any;

      const lang = user.language || 'vi';
      const total = totalStudy?.total || 0;
      const days = totalStudy?.days || 0;

      const msg = lang === 'vi'
        ? `📊 BÁO CÁO TUẦN\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Số ngày học: ${days}/7\n⏱️ Tổng: ${Math.floor(total / 60)}h ${total % 60}m\n🔥 Streak: ${user.study_streak || 0} ngày\n\n${days >= 5 ? '🌟 Tuần tuyệt vời!' : days >= 3 ? '💪 Khá tốt, cố gắng thêm!' : '📚 Cần tăng cường học hơn!'}\n\nDùng /progress để xem chi tiết.`
        : `📊 WEEKLY REPORT\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Days studied: ${days}/7\n⏱️ Total: ${Math.floor(total / 60)}h ${total % 60}m\n🔥 Streak: ${user.study_streak || 0} days\n\n${days >= 5 ? '🌟 Great week!' : days >= 3 ? '💪 Good, push harder!' : '📚 Need more study time!'}\n\nUse /progress for details.`;

      bot.telegram.sendMessage(user.telegram_id, msg).catch(err => {
        console.error(`Failed to send weekly report:`, err.message);
      });
    }
  });

  // Auto-harvest questions daily at 03:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('Running automated question harvester...');
    try {
      const { runHarvester } = await import('./harvester');
      const result = await runHarvester();
      console.log(`Harvester completed: ${result.articlesProcessed} articles, ${result.questionsGenerated} new questions`);
    } catch (e) {
      console.error('Harvester cron error:', e);
    }
  });

  // Auto-schedule monthly mock test - runs on 20th at 10:00 AM
  cron.schedule('0 10 20 * *', async () => {
    console.log('Running auto-scheduler for monthly mock tests...');
    const { getNotionEvents, isNotionConfigured } = await import('./notion');
    
    if (!isNotionConfigured()) {
      console.log('Notion not configured, skipping auto-schedule.');
      return;
    }

    const users = db.prepare('SELECT id, telegram_id, language FROM users').all() as any[];
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Find all Saturdays and Sundays in the remaining of the month
    const weekends: Date[] = [];
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let day = 21; day <= lastDay; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === 0 || d.getDay() === 6) weekends.push(d);
    }

    if (weekends.length === 0) return;

    const startDate = weekends[0].toISOString().split('T')[0];
    const endDate = weekends[weekends.length - 1].toISOString().split('T')[0];

    const events = await getNotionEvents(startDate, endDate);
    
    // Map dates to event counts
    const eventCounts: Record<string, number> = {};
    weekends.forEach(d => eventCounts[d.toISOString().split('T')[0]] = 0);
    
    events.forEach(evt => {
      if (eventCounts[evt.date] !== undefined) {
        eventCounts[evt.date]++;
      }
    });

    // Find the day with minimum events
    let bestDate = Object.keys(eventCounts)[0];
    let minEvents = eventCounts[bestDate];

    for (const [date, count] of Object.entries(eventCounts)) {
      if (count < minEvents) {
        minEvents = count;
        bestDate = date;
      }
    }

    // Schedule test for each user
    for (const user of users) {
      // Check if they already have a test scheduled in the future
      const existing = db.prepare(
        `SELECT * FROM scheduled_tests WHERE user_id = ? AND status = 'scheduled' AND test_date >= date('now')`
      ).get(user.id);

      if (!existing) {
        db.prepare(`INSERT INTO scheduled_tests (user_id, test_date, test_type, status) VALUES (?, ?, 'monthly', 'scheduled')`)
          .run(user.id, bestDate);
          
        // Push this event back to Notion Database so it appears in Notion Calendar
        const { createNotionEvent } = await import('./notion');
        await createNotionEvent(
          'IELTS Monthly Mock Test',
          bestDate,
          'Auto-scheduled by IELTS Buddy Bot for the most free weekend day.'
        );

        const lang = user.language || 'vi';
        const msg = lang === 'vi'
          ? `🤖 *AI AUTO-SCHEDULE*\n━━━━━━━━━━━━━━━━━━━━━━\nTôi đã soi lịch Notion của bạn và thấy ngày *${bestDate}* là cuối tuần rảnh rỗi nhất (chỉ có ${minEvents} sự kiện).\n\nTôi đã tự động xếp lịch *Thi thử IELTS định kỳ (Monthly Mock Test)* vào ngày này để bạn chuẩn bị nhé! Sự kiện này cũng đã được tự động thêm vào Notion Calendar của bạn. 💪\n\nNếu muốn đổi lịch, hãy dùng lệnh /schedule.`
          : `🤖 *AI AUTO-SCHEDULE*\n━━━━━━━━━━━━━━━━━━━━━━\nI analyzed your Notion Calendar and found that *${bestDate}* is your most free weekend (only ${minEvents} events).\n\nI have automatically scheduled your *Monthly Mock Test* on this date so you can prepare! This event has also been added to your Notion Calendar. 💪\n\nUse /schedule if you want to change it.`;

        bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'Markdown' }).catch((err: any) => {
          console.error(`Failed to send auto-schedule notice to ${user.telegram_id}:`, err.message);
        });
      }
    }
  });

  console.log('⏰ Scheduler initialized');
}
