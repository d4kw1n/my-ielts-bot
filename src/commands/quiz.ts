import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { shuffleArray } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

const activeQuizzes = new Map<string, { questions: QuizQuestion[]; current: number; correct: number; total: number }>();

function getQuizQuestions(count: number = 5): QuizQuestion[] {
  // Pull random questions from question_bank (prefer vocabulary type)
  const dbQuestions = db.prepare(`
    SELECT id, question, options, answer, explanation 
    FROM question_bank 
    WHERE options IS NOT NULL AND options != '' AND answer IS NOT NULL
    ORDER BY RANDOM() 
    LIMIT ?
  `).all(count) as any[];

  if (dbQuestions.length >= count) {
    return dbQuestions.map((q: any) => {
      let opts: string[] = [];
      try { opts = JSON.parse(q.options); } catch { opts = []; }
      return {
        id: q.id,
        question: q.question,
        options: opts,
        answer: typeof q.answer === 'number' ? q.answer : parseInt(q.answer, 10) || 0,
        explanation: q.explanation || '',
      };
    }).filter(q => q.options.length >= 2);
  }

  const fallback: { id: number; question: string; options: string[]; answer: number; explanation: string }[] = [
    { id: 0, question: 'What does "ubiquitous" mean?', options: ['Rare', 'Everywhere', 'Dangerous', 'Beautiful'], answer: 1, explanation: 'Ubiquitous = found everywhere' },
    { id: 0, question: 'What does "pragmatic" mean?', options: ['Dreamy', 'Practical', 'Dramatic', 'Romantic'], answer: 1, explanation: 'Pragmatic = dealing with things realistically' },
    { id: 0, question: 'What does "exacerbate" mean?', options: ['Improve', 'Worsen', 'Create', 'Remove'], answer: 1, explanation: 'Exacerbate = make worse' },
    { id: 0, question: 'What does "meticulous" mean?', options: ['Careless', 'Fast', 'Thorough', 'Simple'], answer: 2, explanation: 'Meticulous = showing great attention to detail' },
    { id: 0, question: 'What does "mitigate" mean?', options: ['Increase', 'Reduce', 'Create', 'Ignore'], answer: 1, explanation: 'Mitigate = make less severe' },
    { id: 0, question: 'What does "resilient" mean?', options: ['Weak', 'Recoverable', 'Angry', 'Slow'], answer: 1, explanation: 'Resilient = able to recover quickly' },
    { id: 0, question: 'What does "detrimental" mean?', options: ['Helpful', 'Harmful', 'Neutral', 'Exciting'], answer: 1, explanation: 'Detrimental = causing harm or damage' },
    { id: 0, question: 'What does "unprecedented" mean?', options: ['Common', 'Never before', 'Expected', 'Predicted'], answer: 1, explanation: 'Unprecedented = never done or known before' },
  ];

  const shuffledFallback = shuffleArray(fallback).slice(0, count).map(q => {
    const correctOption = q.options[q.answer];
    const shuffledOpts = shuffleArray(q.options);
    return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctOption) };
  });
  return shuffledFallback;
}

export function registerQuizCommand(bot: any): void {
  bot.command('quiz', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const questions = getQuizQuestions(5);
    
    if (questions.length === 0) {
      await ctx.reply(lang === 'vi' ? '❌ Chưa có câu hỏi. Dùng /bank để thu thập câu hỏi trước.' : '❌ No questions available. Use /bank to harvest first.');
      return;
    }

    activeQuizzes.set(telegramId, { questions, current: 0, correct: 0, total: questions.length });
    const intro = lang === 'vi'
      ? `📚 VOCABULARY QUIZ\n━━━━━━━━━━━━━━━━━━━━━━\n${questions.length} câu hỏi từ kho đề IELTS`
      : `📚 VOCABULARY QUIZ\n━━━━━━━━━━━━━━━━━━━━━━\n${questions.length} questions from IELTS question bank`;
    await ctx.reply(intro);
    await sendQuizQ(ctx, telegramId);
  });

  bot.action(/^quiz_(\d+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const quiz = activeQuizzes.get(telegramId);
    if (!quiz) { await ctx.answerCbQuery(); return; }

    const match = (ctx as any).match;
    const selected = parseInt(match[1], 10);
    const q = quiz.questions[quiz.current];
    const isCorrect = selected === q.answer;

    if (isCorrect) quiz.correct++;

    const emoji = isCorrect ? '✅' : '❌';
    const correctOption = q.options[q.answer] || '?';
    const explanation = q.explanation ? `\n💡 ${q.explanation}` : '';
    
    await ctx.answerCbQuery(isCorrect ? '✅ Correct!' : '❌ Wrong!');
    await ctx.editMessageText(
      `${emoji} ${q.question}\n\n${lang === 'vi' ? 'Đáp án đúng' : 'Correct answer'}: ${correctOption}${explanation}`
    );

    quiz.current++;

    if (quiz.current >= quiz.total) {
      const pct = Math.round((quiz.correct / quiz.total) * 100);
      const grade = pct >= 80 ? '🌟 Excellent!' : pct >= 60 ? '💪 Good!' : '📚 Keep studying!';
      await ctx.reply(
        lang === 'vi'
          ? `📊 KẾT QUẢ QUIZ\n━━━━━━━━━━━━━━━━━━━━━━\n✅ Đúng: ${quiz.correct}/${quiz.total} (${pct}%)\n${grade}\n\n💡 Dùng /quiz để chơi lại!`
          : `📊 QUIZ RESULTS\n━━━━━━━━━━━━━━━━━━━━━━\n✅ Correct: ${quiz.correct}/${quiz.total} (${pct}%)\n${grade}\n\n💡 Use /quiz to play again!`
      );
      activeQuizzes.delete(telegramId);
    } else {
      await sendQuizQ(ctx, telegramId);
    }
  });
}

async function sendQuizQ(ctx: Context, telegramId: string) {
  const quiz = activeQuizzes.get(telegramId);
  if (!quiz) return;

  const lang = getUserLang(telegramId);
  const q = quiz.questions[quiz.current];
  const num = quiz.current + 1;

  const buttons = q.options.map((opt, i) => [Markup.button.callback(opt, `quiz_${i}`)]);

  await ctx.reply(
    `❓ ${lang === 'vi' ? 'Câu' : 'Q'}${num}/${quiz.total}: ${q.question}`,
    Markup.inlineKeyboard(buttons)
  );
}
