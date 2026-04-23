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
      ? `📚 **HƯỚNG DẪN SỬ DỤNG BỘ LỆNH CỦA IELTS BUDDY** 📚

🔹 **Hệ thống & Cài đặt**
/start - Bắt đầu lại bot và mở Menu chính
/help - Xem danh sách lệnh
/settings - Cài đặt mục tiêu, ngôn ngữ, nhắc nhở
/lang - Chuyển đổi ngôn ngữ (VI/EN)

🔹 **Lộ trình & Tài liệu**
/placement - Làm bài test 20 câu để xếp lớp (đoán band score)
/plan - Xem lộ trình học chi tiết của bạn
/resources - Kho tài liệu chọn lọc (Sách & Website)
/tips - Mẹo thi IELTS cho các kỹ năng

🔹 **Luyện tập AI**
/ask <câu hỏi> - Hỏi AI bất cứ điều gì về IELTS
/video - AI gọi ý video Youtube luyện nghe tiếng Anh
/quiz - Chơi game câu hỏi từ vựng IELTS ngẫu nhiên
/write - ✍️ Luyện viết Task 2, AI chấm theo 4 tiêu chí IELTS

🔹 **Học hàng ngày (Adaptive Band)**
/vocab - Học 1 từ vựng IELTS (có chọn chủ đề)
/grammar - Học 1 cấu trúc ngữ pháp
/phrase - Học 1 cụm từ / thành ngữ
/review - 🧠 Ôn tập cuối ngày (Quiz trắc nghiệm)

🔹 **Ghi nhận & Tiến trình**
/log <kỹ năng> <số phút> - Ghi nhận thời gian học (VD: /log listening 30)
/today - Xem tổng kết thời gian học trong ngày hôm nay
/week - Xem báo cáo thời gian học trong tuần
/score <L> <R> <W> <S> - Ghi nhận điểm thi thử (VD: /score 6.5 6.0 6.0 6.5)
/history - Xem lịch sử các bài thi thử
/progress - Vẽ biểu đồ đánh giá tiến trình học tập

🔹 **Phân tích & Quản lý**
/weakness - 🧠 Phân tích điểm yếu cá nhân
/mistakes - 📊 Xem lỗi sai lặp lại
/bank - 📦 Xem thống kê kho câu hỏi

🔹 **Lịch trình**
/schedule - Lên lịch thi thử với Notion Calendar
/next_test - Xem ngày thi thử sắp tới
/remind <HH:MM> - Hẹn giờ bot nhắc nhở học hàng ngày

💡 *Hệ thống SRS tự động nhắc ôn từ vựng theo lịch: 1→3→7→14→30 ngày*`
      : `📚 **IELTS BUDDY COMMAND GUIDE** 📚

🔹 **System & Settings**
/start - Restart bot and show Main Menu
/help - Show this command list
/settings - Set your target, language, reminders
/lang - Toggle language (VI/EN)

🔹 **Plan & Resources**
/placement - Take a 20-question test to estimate your band
/plan - View your customized study plan
/resources - Curated library of books and websites
/tips - IELTS tips for your current phase

🔹 **AI Practice**
/ask <question> - Ask AI anything about IELTS
/video - Get AI recommendations for YouTube listening practice
/quiz - Play a random IELTS vocabulary quiz
/write - ✍️ Writing Task 2 practice with AI grading (4 criteria)

🔹 **Daily Learning (Adaptive Band)**
/vocab - Learn 1 IELTS vocabulary (topic selection)
/grammar - Learn 1 grammar structure
/phrase - Learn 1 phrase / idiom
/review - 🧠 End-of-day review quiz

🔹 **Tracking & Progress**
/log <skill> <minutes> - Log study time (e.g., /log listening 30)
/today - View today's study summary
/week - View weekly study report
/score <L> <R> <W> <S> - Log mock test scores (e.g., /score 6.5 6.0 6.0 6.5)
/history - View mock test history
/progress - View progress reports and charts

🔹 **Analysis & Management**
/weakness - 🧠 Personal weakness analysis
/mistakes - 📊 View repeated errors
/bank - 📦 Question bank stats

🔹 **Scheduling**
/schedule - Schedule a mock test with Notion Calendar
/next_test - Check your upcoming mock test
/remind <HH:MM> - Set a daily study reminder

💡 *SRS automatically reminds you to review vocabulary: 1→3→7→14→30 days*`;

    // Menu shortcuts
    const buttons = [
      [
        Markup.button.callback(lang === 'vi' ? '🏠 Menu Chính' : '🏠 Main Menu', 'main_menu'),
        Markup.button.callback(lang === 'vi' ? '⚙️ Cài đặt' : '⚙️ Settings', 'show_settings')
      ]
    ];

    await ctx.reply(helpMsg, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  });
}
