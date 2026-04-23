import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import db from '../database/db';
import { checkAndRefillQuestionBank } from './question_generator';

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
      `SELECT telegram_id, language, daily_reminder_time FROM users WHERE reminder_enabled = 1 AND daily_reminder_time = ?`
    ).all(currentTime) as any[];

    for (const user of users) {
      const lang = user.language || 'vi';
      const suggestions = studySuggestions[lang as 'vi' | 'en'];
      const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

      const msg = lang === 'vi'
        ? `⏰ Nhắc nhở học IELTS!\n\nHôm nay bạn đã học chưa? Mục tiêu: 1-2 giờ/ngày\n\n📌 Gợi ý hôm nay:\n${suggestion}\n\nDùng /log để ghi nhận khi học xong! 💪`
        : `⏰ IELTS Study Reminder!\n\nHave you studied today? Target: 1-2 hours/day\n\n📌 Today's suggestion:\n${suggestion}\n\nUse /log to record when done! 💪`;

      bot.telegram.sendMessage(user.telegram_id, msg).catch(err => {
        console.error(`Failed to send reminder to ${user.telegram_id}:`, err.message);
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

  // Auto-generate questions using AI every 6 hours
  cron.schedule('0 */6 * * *', () => {
    console.log('Running automated question bank check...');
    checkAndRefillQuestionBank();
  });

  console.log('⏰ Scheduler initialized');
}
