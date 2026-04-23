// Bilingual message system for the bot

type Lang = 'vi' | 'en';

interface Messages {
  [key: string]: {
    vi: string;
    en: string;
  };
}

const messages: Messages = {
  // Welcome & Start
  welcome_title: {
    vi: '🎯 IELTS Study Tracker Bot',
    en: '🎯 IELTS Study Tracker Bot',
  },
  welcome_message: {
    vi: `Xin chào! 👋 Tôi là IELTS Buddy - trợ lý học IELTS của bạn.

Tôi sẽ giúp bạn:
📋 Lên kế hoạch học tập theo phase
📊 Theo dõi tiến trình đạt mục tiêu
📝 Ghi nhận thời gian học hàng ngày
🗓️ Lên lịch kiểm tra hàng tháng
📚 Gợi ý tài liệu học tập
🧠 Mini quiz từ vựng

Bắt đầu với /plan để xem kế hoạch học!`,
    en: `Hello! 👋 I'm IELTS Buddy - your IELTS study assistant.

I'll help you:
📋 Create a phased study plan
📊 Track your progress toward your target
📝 Log daily study time
🗓️ Schedule monthly mock tests
📚 Recommend learning resources
🧠 Mini vocabulary quizzes

Start with /plan to see your study plan!`,
  },
  
  // Language selection
  select_language: {
    vi: '🌐 Chọn ngôn ngữ / Select language:',
    en: '🌐 Select language / Chọn ngôn ngữ:',
  },
  language_set: {
    vi: '✅ Đã chuyển sang Tiếng Việt 🇻🇳',
    en: '✅ Switched to English 🇬🇧',
  },

  // Plan
  plan_title: {
    vi: '📋 KẾ HOẠCH HỌC IELTS 7.0',
    en: '📋 IELTS 7.0 STUDY PLAN',
  },
  plan_phase1_title: {
    vi: '🌱 PHASE 1: NỀN TẢNG (Tháng 1-2)',
    en: '🌱 PHASE 1: FOUNDATION (Month 1-2)',
  },
  plan_phase1: {
    vi: `🎧 Listening: Nghe BBC/TED hàng ngày, làm quen format đề
📖 Reading: Đọc báo tiếng Anh, làm quen dạng câu hỏi
✍️ Writing: Học cấu trúc essay, vocabulary theo chủ đề
🗣️ Speaking: Luyện phát âm, học idioms, practice Part 1
📚 Vocabulary: 15-20 từ mới/ngày theo chủ đề IELTS`,
    en: `🎧 Listening: Listen to BBC/TED daily, learn test format
📖 Reading: Read English articles, learn question types
✍️ Writing: Learn essay structures, topic vocabulary
🗣️ Speaking: Pronunciation practice, idioms, Part 1
📚 Vocabulary: 15-20 new words/day by IELTS topic`,
  },
  plan_phase2_title: {
    vi: '🔥 PHASE 2: LUYỆN TẬP CHUYÊN SÂU (Tháng 3-4)',
    en: '🔥 PHASE 2: INTENSIVE PRACTICE (Month 3-4)',
  },
  plan_phase2: {
    vi: `🎧 Listening: Luyện đề Cambridge, focus Section 3-4
📖 Reading: Luyện đề bấm giờ (20 phút/passage)
✍️ Writing: Viết 2-3 essays/tuần, nhận feedback
🗣️ Speaking: Mock test Part 2 (cue card) & Part 3
📝 Grammar: Advanced structures cho Writing & Speaking`,
    en: `🎧 Listening: Cambridge practice, focus Section 3-4
📖 Reading: Timed practice (20 min/passage)
✍️ Writing: Write 2-3 essays/week, get feedback
🗣️ Speaking: Mock Part 2 (cue card) & Part 3
📝 Grammar: Advanced structures for Writing & Speaking`,
  },
  plan_phase3_title: {
    vi: '🎯 PHASE 3: THI THỬ & HOÀN THIỆN (Tháng 5-6)',
    en: '🎯 PHASE 3: MOCK TEST & REFINE (Month 5-6)',
  },
  plan_phase3: {
    vi: `📝 Full mock tests: 2 lần/tuần
🔍 Error analysis: Phân tích lỗi sai, focus điểm yếu
✍️ Writing: Polish essay templates
🗣️ Speaking: Daily 15-min practice
⏱️ Test strategies: Time management, stress handling`,
    en: `📝 Full mock tests: 2 times/week
🔍 Error analysis: Analyze mistakes, focus weak areas
✍️ Writing: Polish essay templates
🗣️ Speaking: Daily 15-min practice
⏱️ Test strategies: Time management, stress handling`,
  },

  // Study logging
  log_success: {
    vi: '✅ Đã ghi nhận! {skill} - {duration} phút',
    en: '✅ Logged! {skill} - {duration} minutes',
  },
  log_usage: {
    vi: `📝 Ghi nhận thời gian học:

/log listening 30 [ghi chú]
/log reading 45 Cambridge 18 test 1
/log writing 60 Task 2 essay
/log speaking 20 Part 2 practice
/log vocabulary 15 Topic: Environment
/log grammar 30 Complex sentences`,
    en: `📝 Log your study time:

/log listening 30 [notes]
/log reading 45 Cambridge 18 test 1
/log writing 60 Task 2 essay
/log speaking 20 Part 2 practice
/log vocabulary 15 Topic: Environment
/log grammar 30 Complex sentences`,
  },

  // Scores
  score_usage: {
    vi: `📊 Nhập điểm mock test:

/score 6.5 6.0 5.5 6.0
(Thứ tự: Listening Reading Writing Speaking)

Hoặc: /score 6.5 6.0 5.5 6.0 monthly Cambridge 18`,
    en: `📊 Enter mock test scores:

/score 6.5 6.0 5.5 6.0
(Order: Listening Reading Writing Speaking)

Or: /score 6.5 6.0 5.5 6.0 monthly Cambridge 18`,
  },
  score_saved: {
    vi: '✅ Đã lưu điểm thành công!',
    en: '✅ Score saved successfully!',
  },

  // Progress
  no_scores: {
    vi: '❌ Chưa có điểm nào. Dùng /score để nhập điểm mock test đầu tiên hoặc /placement để làm bài test đánh giá trình độ.',
    en: '❌ No scores yet. Use /score to enter your first mock test score or /placement for a level assessment.',
  },

  // Resources
  resources_title: {
    vi: '📚 TÀI NGUYÊN HỌC TẬP',
    en: '📚 LEARNING RESOURCES',
  },
  select_skill: {
    vi: 'Chọn kỹ năng:',
    en: 'Select a skill:',
  },

  // Placement test
  placement_intro: {
    vi: `🧪 BÀI TEST ĐÁNH GIÁ TRÌNH ĐỘ

Bài test gồm 20 câu hỏi để ước lượng band score hiện tại của bạn.
Bao gồm: Vocabulary, Grammar, Reading Comprehension

⏱️ Thời gian: ~10 phút
Sẵn sàng chưa?`,
    en: `🧪 PLACEMENT TEST

20 questions to estimate your current band score.
Includes: Vocabulary, Grammar, Reading Comprehension

⏱️ Time: ~10 minutes
Ready?`,
  },

  // Reminders
  daily_reminder: {
    vi: `⏰ Nhắc nhở học IELTS!

Hôm nay bạn đã học chưa? Mục tiêu: 1-2 giờ/ngày

📌 Gợi ý hôm nay:
{suggestion}

Dùng /log để ghi nhận khi học xong! 💪`,
    en: `⏰ IELTS Study Reminder!

Have you studied today? Target: 1-2 hours/day

📌 Today's suggestion:
{suggestion}

Use /log to record when done! 💪`,
  },

  // Streak
  streak_message: {
    vi: '🔥 Streak: {days} ngày liên tục!',
    en: '🔥 Streak: {days} consecutive days!',
  },

  // Schedule
  schedule_test_prompt: {
    vi: '🗓️ Chọn ngày kiểm tra tháng này:',
    en: '🗓️ Select test date for this month:',
  },
  test_scheduled: {
    vi: '✅ Đã lên lịch kiểm tra ngày {date}',
    en: '✅ Test scheduled for {date}',
  },

  // Settings
  settings_title: {
    vi: '⚙️ CÀI ĐẶT',
    en: '⚙️ SETTINGS',
  },

  // Errors
  error_generic: {
    vi: '❌ Đã xảy ra lỗi. Vui lòng thử lại.',
    en: '❌ An error occurred. Please try again.',
  },
};

export function t(key: string, lang: Lang = 'vi', replacements?: Record<string, string>): string {
  const msg = messages[key];
  if (!msg) return key;
  let text = msg[lang] || msg.vi;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

export type { Lang };
