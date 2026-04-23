import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

const quizQuestions = [
  { word: 'ubiquitous', options: ['Rare', 'Everywhere', 'Dangerous', 'Beautiful'], answer: 1, level: 'C1' },
  { word: 'pragmatic', options: ['Dreamy', 'Practical', 'Dramatic', 'Romantic'], answer: 1, level: 'C1' },
  { word: 'exacerbate', options: ['Improve', 'Worsen', 'Create', 'Remove'], answer: 1, level: 'C1' },
  { word: 'meticulous', options: ['Careless', 'Fast', 'Thorough', 'Simple'], answer: 2, level: 'B2' },
  { word: 'eloquent', options: ['Quiet', 'Expressive', 'Angry', 'Lazy'], answer: 1, level: 'C1' },
  { word: 'mitigate', options: ['Increase', 'Reduce', 'Create', 'Ignore'], answer: 1, level: 'B2' },
  { word: 'ambiguous', options: ['Clear', 'Unclear', 'Wrong', 'Right'], answer: 1, level: 'B2' },
  { word: 'resilient', options: ['Weak', 'Recoverable', 'Angry', 'Slow'], answer: 1, level: 'B2' },
  { word: 'detrimental', options: ['Helpful', 'Harmful', 'Neutral', 'Exciting'], answer: 1, level: 'B2' },
  { word: 'unprecedented', options: ['Common', 'Never before', 'Expected', 'Predicted'], answer: 1, level: 'B2' },
  { word: 'inevitable', options: ['Avoidable', 'Certain', 'Unlikely', 'Possible'], answer: 1, level: 'B2' },
  { word: 'alleviate', options: ['Worsen', 'Lessen', 'Cause', 'Prevent'], answer: 1, level: 'B2' },
  { word: 'conducive', options: ['Harmful', 'Favorable', 'Neutral', 'Boring'], answer: 1, level: 'B2' },
  { word: 'preclude', options: ['Allow', 'Prevent', 'Encourage', 'Start'], answer: 1, level: 'C1' },
  { word: 'superfluous', options: ['Necessary', 'Extra', 'Important', 'Missing'], answer: 1, level: 'C1' },
];

const activeQuizzes = new Map<string, { questions: typeof quizQuestions; current: number; correct: number; total: number }>();

export function registerQuizCommand(bot: any): void {
  bot.command('quiz', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const shuffled = [...quizQuestions].sort(() => Math.random() - 0.5).slice(0, 5);
    activeQuizzes.set(telegramId, { questions: shuffled, current: 0, correct: 0, total: 5 });
    const intro = lang === 'vi'
      ? `📚 VOCABULARY QUIZ\n━━━━━━━━━━━━━━━━━━━━━━\n5 câu hỏi từ vựng IELTS nâng cao`
      : `📚 VOCABULARY QUIZ\n━━━━━━━━━━━━━━━━━━━━━━\n5 advanced IELTS vocabulary questions`;
    await ctx.reply(intro);
    await sendQuizQ(ctx, telegramId);
  });

  bot.action(/^quiz_(\d+)_(\d+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const qIndex = parseInt(match[1]);
    const selected = parseInt(match[2]);
    const lang = getUserLang(telegramId);
    const quiz = activeQuizzes.get(telegramId);
    if (!quiz || qIndex !== quiz.current) { await ctx.answerCbQuery('Expired'); return; }
    const q = quiz.questions[quiz.current];
    const isCorrect = selected === q.answer;
    if (isCorrect) quiz.correct++;
    quiz.current++;
    await ctx.answerCbQuery(isCorrect ? '✅' : '❌');
    const fb = isCorrect ? `✅ "${q.word}" = ${q.options[q.answer]}` : `❌ "${q.word}" = ${q.options[q.answer]}`;
    if (quiz.current >= quiz.total) {
      const pct = Math.round((quiz.correct / quiz.total) * 100);
      const r = `${fb}\n\n📊 ${lang === 'vi' ? 'KẾT QUẢ' : 'RESULTS'}: ${quiz.correct}/${quiz.total} (${pct}%)\n${pct >= 80 ? '🌟' : pct >= 60 ? '💪' : '📚'} ${pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good!' : 'Keep learning!'}\n\n/quiz - ${lang === 'vi' ? 'Làm quiz mới' : 'New quiz'}`;
      await ctx.editMessageText(r);
      activeQuizzes.delete(telegramId);
    } else {
      await ctx.editMessageText(fb);
      setTimeout(() => sendQuizQ(ctx, telegramId), 500);
    }
  });
}

async function sendQuizQ(ctx: Context, tid: string): Promise<void> {
  const lang = getUserLang(tid);
  const quiz = activeQuizzes.get(tid);
  if (!quiz) return;
  const q = quiz.questions[quiz.current];
  const msg = `📚 ${lang === 'vi' ? 'Câu' : 'Q'} ${quiz.current + 1}/${quiz.total} (${q.level})\n\n🔤 "${q.word}" ${lang === 'vi' ? 'có nghĩa là' : 'means'}:`;
  const btns = q.options.map((o, i) => [Markup.button.callback(`${String.fromCharCode(65 + i)}. ${o}`, `quiz_${quiz.current}_${i}`)]);
  await ctx.reply(msg, Markup.inlineKeyboard(btns));
}
