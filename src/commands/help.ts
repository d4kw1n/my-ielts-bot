import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerHelpCommand(bot: any): void {
  bot.command('help', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const helpMsg = lang === 'vi'
      ? `📚 <b>HƯỚNG DẪN SỬ DỤNG BỘ LỆNH CỦA IELTS BUDDY</b> 📚

🔹 <b>Hệ thống &amp; Cài đặt</b>
/start - Bắt đầu lại bot và mở Menu chính
/help - Xem danh sách lệnh
/settings - Cài đặt mục tiêu, ngôn ngữ, nhắc nhở
/lang - Chuyển đổi ngôn ngữ (VI/EN)

🔹 <b>Lộ trình &amp; Tài liệu</b>
/placement - Làm bài test 20 câu để xếp lớp
/plan - Xem lộ trình học chi tiết
/today_plan - 📋 Kế hoạch học cụ thể hôm nay
/resources - Kho tài liệu chọn lọc
/tips - Mẹo thi IELTS

🔹 <b>Luyện tập 4 kỹ năng</b>
/vocab - 📚 Học từ vựng IELTS (chọn chủ đề)
/grammar - 📝 Học cấu trúc ngữ pháp
/phrase - 💬 Học cụm từ / thành ngữ
/read - 📖 Luyện đọc hiểu Reading
/write - ✍️ Luyện viết Task 2 (AI chấm 4 tiêu chí)
/speak - 🗣️ Luyện nói Speaking Part 1/2/3
/template - 📋 Xem mẫu cấu trúc essay
/review - 🧠 Ôn tập cuối ngày (Quiz)

🔹 <b>Công cụ AI</b>
/ask - Hỏi AI bất cứ điều gì về IELTS
/video - AI gợi ý video Youtube luyện nghe
/quiz - Game câu hỏi từ vựng ngẫu nhiên
/import - Bóc tách câu hỏi từ URL/văn bản

🔹 <b>Ghi nhận &amp; Tiến trình</b>
/log - Ghi nhận thời gian học (VD: /log listening 30)
/today - Tổng kết học trong ngày
/week - Báo cáo tuần
/score - Ghi điểm thi thử (VD: /score 6.5 6.0 6.0 6.5)
/history - Lịch sử thi thử
/progress - Biểu đồ tiến trình

🔹 <b>Phân tích &amp; Quản lý</b>
/weakness - 🧠 Phân tích điểm yếu cá nhân
/mistakes - 📊 Xem lỗi sai lặp lại
/bank - 📦 Thống kê kho câu hỏi

🔹 <b>Lịch trình</b>
/schedule - Lên lịch thi thử
/next_test - Xem ngày thi sắp tới
/remind - Hẹn giờ nhắc nhở (VD: /remind 08:00)

💡 <i>SRS tự động nhắc ôn từ vựng: 1→3→7→14→30 ngày</i>`
      : `📚 <b>IELTS BUDDY COMMAND GUIDE</b> 📚

🔹 <b>System &amp; Settings</b>
/start - Restart bot and show Main Menu
/help - Show this command list
/settings - Set target, language, reminders
/lang - Toggle language (VI/EN)

🔹 <b>Plan &amp; Resources</b>
/placement - Take a 20-question placement test
/plan - View your study plan
/today_plan - 📋 Today's personalized study plan
/resources - Curated books and websites
/tips - IELTS tips for your phase

🔹 <b>4-Skill Practice</b>
/vocab - 📚 Learn IELTS vocabulary (by topic)
/grammar - 📝 Learn grammar structures
/phrase - 💬 Learn phrases / idioms
/read - 📖 Reading comprehension practice
/write - ✍️ Writing Task 2 with AI grading
/speak - 🗣️ Speaking Part 1/2/3 practice
/template - 📋 Essay structure templates
/review - 🧠 End-of-day review quiz

🔹 <b>AI Tools</b>
/ask - Ask AI anything about IELTS
/video - AI-recommended YouTube videos
/quiz - Random vocabulary quiz game
/import - Extract questions from URL/text

🔹 <b>Tracking &amp; Progress</b>
/log - Log study time (e.g., /log listening 30)
/today - Today's study summary
/week - Weekly study report
/score - Log mock test scores (e.g., /score 6.5 6.0 6.0 6.5)
/history - Mock test history
/progress - Progress charts

🔹 <b>Analysis &amp; Management</b>
/weakness - 🧠 Personal weakness analysis
/mistakes - 📊 View repeated errors
/bank - 📦 Question bank stats

🔹 <b>Scheduling</b>
/schedule - Schedule a mock test
/next_test - Check upcoming test
/remind - Set daily reminder (e.g., /remind 08:00)

💡 <i>SRS auto-reviews vocabulary: 1→3→7→14→30 days</i>`;

    // Menu shortcuts
    const buttons = [
      [
        Markup.button.callback(lang === 'vi' ? '🏠 Menu Chính' : '🏠 Main Menu', 'main_menu'),
        Markup.button.callback(lang === 'vi' ? '⚙️ Cài đặt' : '⚙️ Settings', 'go_settings')
      ]
    ];

    await ctx.reply(helpMsg, { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  });
}

