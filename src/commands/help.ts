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
      ? `📚 <b>HƯỚNG DẪN SỬ DỤNG IELTS BUDDY</b> 📚

🔹 <b>Hệ thống &amp; Cài đặt</b>
/start - Mở Menu chính
/help - Xem hướng dẫn này
/settings - Cài đặt mục tiêu, ngôn ngữ, nhắc nhở

🔹 <b>Lộ trình học</b>
/today_plan - 📋 Kế hoạch học hôm nay
/plan - Xem lộ trình học chi tiết
/placement - Làm bài test 20 câu để xếp lớp

🔹 <b>Luyện tập 4 kỹ năng</b>
/vocab - 📚 Học từ vựng IELTS (chọn chủ đề)
/grammar - 📝 Học cấu trúc ngữ pháp
/phrase - 💬 Học cụm từ / thành ngữ
/read - 📖 Luyện đọc hiểu Reading
/write - ✍️ Luyện viết Task 2 (AI chấm 4 tiêu chí)
/speak - 🗣️ Luyện nói Speaking Part 1/2/3
/template - 📋 Xem mẫu cấu trúc essay
/review - 🧠 Ôn tập cuối ngày
/quiz - 🎲 Quiz từ vựng từ kho đề

🔹 <b>Công cụ AI</b>
/ask - Hỏi AI bất cứ điều gì về IELTS
/import - Bóc tách câu hỏi từ URL/văn bản
/bank - 📦 Kho câu hỏi + thu thập tự động

🔹 <b>Ghi nhận &amp; Tiến trình</b>
/log - Ghi thời gian học (VD: /log listening 30)
/today - Tổng kết học trong ngày
/score - Ghi điểm thi thử
/progress - Xem tiến trình

🔹 <b>Phân tích</b>
/mistakes - 📊 Phân tích lỗi sai lặp lại

🔹 <b>Lịch trình</b>
/schedule - Lên lịch thi thử
/backup - ☁️ Sao lưu dữ liệu lên Notion

💡 <i>SRS tự động nhắc ôn từ vựng: 1→3→7→14→30 ngày</i>`
      : `📚 <b>IELTS BUDDY COMMAND GUIDE</b> 📚

🔹 <b>System &amp; Settings</b>
/start - Open Main Menu
/help - Show this guide
/settings - Set target, language, reminders

🔹 <b>Study Plan</b>
/today_plan - 📋 Today's study plan
/plan - View your study roadmap
/placement - Take placement test

🔹 <b>4-Skill Practice</b>
/vocab - 📚 Learn IELTS vocabulary
/grammar - 📝 Learn grammar structures
/phrase - 💬 Learn phrases / idioms
/read - 📖 Reading comprehension
/write - ✍️ Writing Task 2 + AI grading
/speak - 🗣️ Speaking Part 1/2/3
/template - 📋 Essay templates
/review - 🧠 End-of-day review
/quiz - 🎲 Vocabulary quiz from question bank

🔹 <b>AI Tools</b>
/ask - Ask AI anything about IELTS
/import - Extract questions from URL/text
/bank - 📦 Question bank + auto-harvest

🔹 <b>Tracking &amp; Progress</b>
/log - Log study time (e.g., /log listening 30)
/today - Today's summary
/score - Log mock test scores
/progress - View progress

🔹 <b>Analysis</b>
/mistakes - 📊 Analyze repeated errors

🔹 <b>Scheduling</b>
/schedule - Schedule a mock test
/backup - ☁️ Backup data to Notion

💡 <i>SRS auto-reviews vocabulary: 1→3→7→14→30 days</i>`;

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
