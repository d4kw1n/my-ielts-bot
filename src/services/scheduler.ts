import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import db from '../database/db';
import { getVietnamTime, getVietnamToday, getVietnamDaysAgo, getVietnamDaysLater, getVietnamNow } from '../utils/helpers';

/**
 * Calculate evenly-spaced send times for vocab/grammar/review throughout a user's waking hours.
 * Returns array of "HH:MM" strings.
 *
 * Layout: [vocab1, vocab2, ..., grammar_slot, ..., vocabN, review]
 * Total slots = vocabCount + 2 (grammar + review)
 */
function calculateSendTimes(wakeTime: string, sleepTime: string, vocabCount: number): string[] {
  const [wakeH, wakeM] = wakeTime.split(':').map(Number);
  const [sleepH, sleepM] = sleepTime.split(':').map(Number);

  // Convert to minutes since midnight
  let wakeMin = wakeH * 60 + wakeM;
  let sleepMin = sleepH * 60 + sleepM;

  // Handle case where sleep is past midnight (e.g., 01:00)
  if (sleepMin <= wakeMin) sleepMin += 24 * 60;

  // Total slots = vocab words + 1 grammar/phrase + 1 review
  const totalSlots = vocabCount + 2;

  // Leave 30 min buffer after wake and before sleep
  const effectiveStart = wakeMin + 30;
  const effectiveEnd = sleepMin - 30;
  const availableMinutes = effectiveEnd - effectiveStart;

  if (availableMinutes < totalSlots * 30) {
    // Not enough time — fall back to basic schedule
    return [formatTime(wakeMin + 60), formatTime(Math.floor((wakeMin + sleepMin) / 2)), formatTime(sleepMin - 60)];
  }

  const interval = Math.floor(availableMinutes / (totalSlots - 1));
  const times: string[] = [];

  for (let i = 0; i < totalSlots; i++) {
    const minutes = effectiveStart + i * interval;
    times.push(formatTime(minutes % (24 * 60)));
  }

  return times;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

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
    const currentTime = getVietnamTime();

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

  cron.schedule('* * * * *', async () => {
    const now = getVietnamNow();
    const currentTime = getVietnamTime();
    const today = getVietnamToday();

    const users = db.prepare(`
      SELECT id, telegram_id, language, wake_time, sleep_time, daily_vocab_count, reminder_enabled
      FROM users WHERE reminder_enabled = 1
    `).all() as any[];

    for (const user of users) {
      const wakeTime = user.wake_time || '07:00';
      const sleepTime = user.sleep_time || '23:00';
      const vocabCount = user.daily_vocab_count || 5;

      // Calculate personalized send times for this user
      const sendTimes = calculateSendTimes(wakeTime, sleepTime, vocabCount);

      // Check if current time matches any send time for this user
      const matchIndex = sendTimes.indexOf(currentTime);
      if (matchIndex === -1) continue;

      // Check how many vocab we already sent today
      const sentToday = db.prepare(
        `SELECT COUNT(*) as cnt FROM learned_items WHERE user_id = ? AND learned_date = ? AND type = 'vocab'`
      ).get(user.id, today) as any;
      const alreadySent = sentToday?.cnt || 0;

      if (alreadySent >= vocabCount) continue; // Already hit daily limit

      // Determine what to send based on slot position
      const totalSlots = sendTimes.length;
      const isLastSlot = matchIndex === totalSlots - 1;
      const isGrammarSlot = matchIndex === Math.floor(totalSlots / 2); // Middle slot = grammar/phrase

      try {
        if (isLastSlot) {
          // Last slot: send review quiz
          const { sendDailyReview } = await import('../commands/daily');
          await sendDailyReview(bot, user.telegram_id, user.telegram_id);
        } else if (isGrammarSlot && totalSlots > 2) {
          // Middle slot: grammar or phrase (alternate days)
          const isGrammarDay = now.getDay() % 2 === 0;
          if (isGrammarDay) {
            const { sendDailyGrammar } = await import('../commands/daily');
            await sendDailyGrammar(bot, user.telegram_id, user.telegram_id);
          } else {
            const { sendDailyPhrase } = await import('../commands/daily');
            await sendDailyPhrase(bot, user.telegram_id, user.telegram_id);
          }
        } else {
          // All other slots: send vocabulary
          const { sendDailyVocab } = await import('../commands/daily');
          await sendDailyVocab(bot, user.telegram_id, user.telegram_id);
        }
      } catch (e: any) {
        console.error(`Failed to send scheduled content to ${user.telegram_id}: ${e.message}`);
      }
    }
  });

  // SRS Spaced Repetition reminder at 12:00
  cron.schedule('0 12 * * *', () => {
    const today = getVietnamToday();
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

      // Only send reminder — mastery is advanced when user actually uses /review
      bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'Markdown' }).catch((err: any) => {
        console.error(`Failed to send SRS reminder to ${user.telegram_id}:`, err.message);
      });
    }
  });

  // Test reminder - check daily at 09:00
  cron.schedule('0 9 * * *', () => {
    const tomorrowStr = getVietnamDaysLater(1);

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
      const weekAgoStr = getVietnamDaysAgo(7);

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

  // Monthly test reminder - runs on 20th at 10:00 AM (no Notion dependency)
  cron.schedule('0 10 20 * *', async () => {
    console.log('Sending monthly mock test reminders...');
    const users = db.prepare('SELECT id, telegram_id, language FROM users').all() as any[];

    for (const user of users) {
      // Check if they already have a test scheduled
      const existing = db.prepare(
        `SELECT * FROM scheduled_tests WHERE user_id = ? AND status = 'scheduled' AND test_date >= date('now')`
      ).get(user.id);

      if (!existing) {
        const lang = user.language || 'vi';
        const msg = lang === 'vi'
          ? `📅 *NHẮC NHỞ THI THỬ HÀNG THÁNG*\n━━━━━━━━━━━━━━━━━━━━━━\nBạn chưa có lịch thi thử tháng này!\n\nĐiều quan trọng nhất để cải thiện IELTS là thi thử định kỳ. Hãy lên lịch ngay!\n\n💡 Dùng /schedule để chọn ngày thi thử.`
          : `📅 *MONTHLY MOCK TEST REMINDER*\n━━━━━━━━━━━━━━━━━━━━━━\nYou don't have a mock test scheduled this month!\n\nRegular practice tests are key to IELTS improvement. Schedule one now!\n\n💡 Use /schedule to pick a date.`;

        bot.telegram.sendMessage(user.telegram_id, msg, { parse_mode: 'Markdown' }).catch((err: any) => {
          console.error(`Failed to send test reminder to ${user.telegram_id}:`, err.message);
        });
      }
    }
  });

  console.log('⏰ Scheduler initialized');
}

