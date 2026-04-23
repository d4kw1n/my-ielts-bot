import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

// In-memory state for placement tests
const activePlacementTests = new Map<string, {
  questions: any[];
  currentQuestion: number;
  answers: number[];
  correctCount: number;
}>();

export function registerPlacementCommand(bot: any): void {
  bot.command('placement', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    // Get 20 questions from bank
    const questions = db.prepare('SELECT * FROM question_bank ORDER BY RANDOM() LIMIT 20').all() as any[];
    
    if (questions.length < 5) {
      await ctx.reply(lang === 'vi' ? 'Kho câu hỏi đang được cập nhật, vui lòng thử lại sau!' : 'Question bank is being updated, please try again later!');
      return;
    }

    const intro = lang === 'vi'
      ? `🧪 BÀI TEST ĐÁNH GIÁ TRÌNH ĐỘ
━━━━━━━━━━━━━━━━━━━━━━

Bài test gồm ${questions.length} câu hỏi để ước lượng band score hiện tại.
Bao gồm: Vocabulary, Grammar, Reading Comprehension

⏱️ Thời gian: ~10 phút

Sẵn sàng chưa?`
      : `🧪 PLACEMENT TEST
━━━━━━━━━━━━━━━━━━━━━━

${questions.length} questions to estimate your current band score.
Includes: Vocabulary, Grammar, Reading Comprehension

⏱️ Time: ~10 minutes

Ready?`;

    await ctx.reply(intro, Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'vi' ? '✅ Bắt đầu!' : '✅ Start!', 'placement_start')],
    ]));
  });

  bot.action('placement_start', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();

    const questions = db.prepare('SELECT * FROM question_bank ORDER BY RANDOM() LIMIT 20').all() as any[];

    // Initialize test
    activePlacementTests.set(telegramId, {
      questions,
      currentQuestion: 0,
      answers: [],
      correctCount: 0,
    });

    await ctx.answerCbQuery();
    await sendPlacementQuestion(ctx, telegramId, 0);
  });

  // Handle placement answers
  bot.action(/^placement_(\d+)_(\d+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const questionIndex = parseInt(match[1]);
    const selectedAnswer = parseInt(match[2]);

    const testState = activePlacementTests.get(telegramId);
    if (!testState) {
      await ctx.answerCbQuery('Test expired. Use /placement to start again.');
      return;
    }

    const question = testState.questions[questionIndex];
    const isCorrect = selectedAnswer === parseInt(question.answer);

    if (isCorrect) {
      testState.correctCount++;
    }
    testState.answers.push(selectedAnswer);
    testState.currentQuestion++;

    await ctx.answerCbQuery(isCorrect ? '✅' : '❌');

    // Check if test is complete
    if (testState.currentQuestion >= testState.questions.length) {
      await finishPlacementTest(ctx, telegramId, testState);
      activePlacementTests.delete(telegramId);
    } else {
      await sendPlacementQuestion(ctx, telegramId, testState.currentQuestion);
    }
  });
}

async function sendPlacementQuestion(ctx: Context, telegramId: string, index: number): Promise<void> {
  const lang = getUserLang(telegramId);
  const testState = activePlacementTests.get(telegramId)!;
  const q = testState.questions[index];

  const questionText = lang === 'vi' && q.question_vi ? q.question_vi : q.question;
  const typeEmoji: Record<string, string> = { vocabulary: '📚', grammar: '📝', reading: '📖' };
  const emoji = typeEmoji[q.type] || '❓';
  const typeLabel = q.type.charAt(0).toUpperCase() + q.type.slice(1);

  let msg = `${emoji} ${lang === 'vi' ? 'Câu' : 'Q'} ${index + 1}/${testState.questions.length} | ${typeLabel} (${q.level})\n\n`;
  msg += questionText;

  let options = [];
  try {
    options = JSON.parse(q.options);
  } catch(e) {}

  const buttons = options.map((opt: string, i: number) =>
    [Markup.button.callback(`${String.fromCharCode(65 + i)}. ${opt}`, `placement_${index}_${i}`)]
  );

  try {
    await ctx.editMessageText(msg, Markup.inlineKeyboard(buttons));
  } catch {
    await ctx.reply(msg, Markup.inlineKeyboard(buttons));
  }
}

async function finishPlacementTest(ctx: Context, telegramId: string, testState: { correctCount: number; answers: number[], questions: any[] }): Promise<void> {
  const lang = getUserLang(telegramId);
  const totalQuestions = testState.questions.length;
  const correct = testState.correctCount;
  const percentage = Math.round((correct / totalQuestions) * 100);

  // Estimate band score based on correct answers
  let estimatedBand: number;
  if (percentage >= 90) estimatedBand = 8.0;
  else if (percentage >= 80) estimatedBand = 7.5;
  else if (percentage >= 70) estimatedBand = 7.0;
  else if (percentage >= 60) estimatedBand = 6.5;
  else if (percentage >= 50) estimatedBand = 6.0;
  else if (percentage >= 40) estimatedBand = 5.5;
  else if (percentage >= 30) estimatedBand = 5.0;
  else if (percentage >= 20) estimatedBand = 4.5;
  else estimatedBand = 4.0;

  // Also calculate weighted band from question difficulty
  let weightedScore = 0;
  let weightedTotal = 0;
  for (let i = 0; i < testState.questions.length; i++) {
    const q = testState.questions[i];
    if (testState.answers[i] === parseInt(q.answer)) {
      weightedScore += q.band;
    }
    weightedTotal += q.band;
  }
  const weightedBand = Math.round((weightedScore / weightedTotal) * 9 * 2) / 2;
  const finalBand = Math.round(((estimatedBand + weightedBand) / 2) * 2) / 2;

  // Save to database
  const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (user) {
    db.prepare(`
      INSERT INTO placement_results (user_id, test_date, total_questions, correct_answers, estimated_band, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, new Date().toISOString().split('T')[0], totalQuestions, correct, finalBand, JSON.stringify(testState.answers));

    // Update user's estimated band
    db.prepare("UPDATE users SET estimated_band = ?, updated_at = datetime('now') WHERE telegram_id = ?")
      .run(finalBand, telegramId);
  }

  // Calculate recommended phase
  let recommendedPhase = 1;
  if (finalBand >= 6.0) recommendedPhase = 3;
  else if (finalBand >= 5.0) recommendedPhase = 2;

  const result = lang === 'vi'
    ? `🧪 KẾT QUẢ ĐÁNH GIÁ TRÌNH ĐỘ
━━━━━━━━━━━━━━━━━━━━━━

✅ Đúng: ${correct}/${totalQuestions} (${percentage}%)

📊 Band ước tính: ${finalBand}

${finalBand >= 7.0 ? '🌟' : finalBand >= 6.0 ? '💪' : finalBand >= 5.0 ? '📚' : '🌱'} ${
  finalBand >= 7.0 ? 'Bạn đã gần mục tiêu! Tập trung luyện đề.'
  : finalBand >= 6.0 ? 'Khá tốt! Cần luyện tập chuyên sâu thêm.'
  : finalBand >= 5.0 ? 'Nền tảng ổn. Cần học thêm nhiều kỹ năng.'
  : 'Cần xây dựng nền tảng vững chắc.'
}

📍 Phase khuyến nghị: Phase ${recommendedPhase}
⏱️ Thời gian ước tính đến 7.0: ${
  finalBand >= 6.5 ? '3-4 tháng'
  : finalBand >= 6.0 ? '4-6 tháng'
  : finalBand >= 5.0 ? '6-9 tháng'
  : '9-12 tháng'
}

━━━━━━━━━━━━━━━━━━━━━━
💡 Dùng /plan để xem kế hoạch học phù hợp!
📚 Dùng /resources để xem tài liệu theo kỹ năng!`
    : `🧪 PLACEMENT TEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━

✅ Correct: ${correct}/${totalQuestions} (${percentage}%)

📊 Estimated Band: ${finalBand}

${finalBand >= 7.0 ? '🌟' : finalBand >= 6.0 ? '💪' : finalBand >= 5.0 ? '📚' : '🌱'} ${
  finalBand >= 7.0 ? 'Almost at target! Focus on practice tests.'
  : finalBand >= 6.0 ? 'Good base! Need intensive practice.'
  : finalBand >= 5.0 ? 'Decent foundation. Work on all skills.'
  : 'Need to build a strong foundation.'
}

📍 Recommended Phase: Phase ${recommendedPhase}
⏱️ Estimated time to 7.0: ${
  finalBand >= 6.5 ? '3-4 months'
  : finalBand >= 6.0 ? '4-6 months'
  : finalBand >= 5.0 ? '6-9 months'
  : '9-12 months'
}

━━━━━━━━━━━━━━━━━━━━━━
💡 Use /plan to see your study plan!
📚 Use /resources for skill-specific materials!`;

  try {
    await ctx.editMessageText(result);
  } catch {
    await ctx.reply(result);
  }
}
