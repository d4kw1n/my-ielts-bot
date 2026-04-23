import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { askAi } from '../services/ai_service';
import { recordMistake } from './mistakes';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

// In-memory reading quiz state
const activeReadingSessions = new Map<string, {
  passage: string;
  questions: { type: string; question: string; options: string[]; answer: number; explanation: string }[];
  currentQuestion: number;
  correctCount: number;
}>();

const readingTopics = [
  { id: 'science', label: '🧬 Science' },
  { id: 'environment', label: '🌍 Environment' },
  { id: 'education', label: '📚 Education' },
  { id: 'technology', label: '💻 Technology' },
  { id: 'health', label: '🏥 Health' },
  { id: 'history', label: '🏛️ History' },
  { id: 'psychology', label: '🧠 Psychology' },
  { id: 'economics', label: '💰 Economics' },
];

export function registerReadCommand(bot: any): void {
  bot.command('read', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const msg = lang === 'vi'
      ? '📖 *LUYỆN ĐỌC HIỂU IELTS READING*\n━━━━━━━━━━━━━━━━━━━━━━\nChọn chủ đề để tạo đoạn văn + câu hỏi:'
      : '📖 *IELTS READING PRACTICE*\n━━━━━━━━━━━━━━━━━━━━━━\nSelect a topic for passage + questions:';

    const buttons = [];
    for (let i = 0; i < readingTopics.length; i += 2) {
      const row = [Markup.button.callback(readingTopics[i].label, `read_topic_${readingTopics[i].id}`)];
      if (readingTopics[i + 1]) {
        row.push(Markup.button.callback(readingTopics[i + 1].label, `read_topic_${readingTopics[i + 1].id}`));
      }
      buttons.push(row);
    }
    buttons.push([Markup.button.callback(lang === 'vi' ? '🎲 Ngẫu nhiên' : '🎲 Random', 'read_topic_random')]);

    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });

  bot.action(/^read_topic_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    let topicId = match[1];
    await ctx.answerCbQuery();

    if (topicId === 'random') {
      topicId = readingTopics[Math.floor(Math.random() * readingTopics.length)].id;
    }

    const user = db.prepare('SELECT target_score, estimated_band FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const band = user?.target_score || 7.0;

    await ctx.editMessageText(lang === 'vi' ? `⏳ Đang tạo đoạn văn chủ đề *${topicId}*...` : `⏳ Generating passage on *${topicId}*...`, { parse_mode: 'Markdown' });

    const prompt = `Generate an IELTS Academic Reading mini-passage (150-200 words) about "${topicId}" suitable for band ${band}, 
then create 4 comprehension questions.

Mix question types:
- 1 True/False/Not Given question
- 1 Multiple choice question  
- 1 Fill-in-the-blank question (choose the best word)
- 1 Inference/main idea question

Return as JSON:
{
  "title": "Passage Title",
  "passage": "The full passage text...",
  "questions": [
    {
      "type": "TFNG",
      "question": "According to the passage, [statement]. True, False, or Not Given?",
      "options": ["True", "False", "Not Given"],
      "answer": 0,
      "explanation": "The passage states that..."
    },
    {
      "type": "MCQ",
      "question": "What does the author suggest about...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 2,
      "explanation": "In paragraph X, the author mentions..."
    },
    {
      "type": "Fill",
      "question": "The word '____' in the passage is closest in meaning to:",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 1,
      "explanation": "In this context, the word means..."
    },
    {
      "type": "Inference",
      "question": "What is the main idea of the passage?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "The passage primarily discusses..."
    }
  ]
}
Only return valid JSON.`;

    try {
      const response = await askAi(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      const data = JSON.parse(jsonMatch[0]);

      if (!data.passage || !data.questions || data.questions.length < 3) throw new Error('Invalid data');

      // Store session
      activeReadingSessions.set(telegramId, {
        passage: data.passage,
        questions: data.questions,
        currentQuestion: 0,
        correctCount: 0,
      });

      // Send the passage first
      const passageMsg = lang === 'vi'
        ? `📖 *${data.title}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n${data.passage}\n\n━━━━━━━━━━━━━━━━━━━━━━\n⏱️ _Đọc kỹ đoạn văn rồi trả lời ${data.questions.length} câu hỏi bên dưới._`
        : `📖 *${data.title}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n${data.passage}\n\n━━━━━━━━━━━━━━━━━━━━━━\n⏱️ _Read carefully, then answer ${data.questions.length} questions below._`;

      await ctx.reply(passageMsg, { parse_mode: 'Markdown' });

      // Send first question
      await sendReadingQuestion(bot, telegramId, ctx.chat!.id);
    } catch (e) {
      console.error('Reading generation error:', e);
      await ctx.reply(lang === 'vi' ? '❌ Lỗi tạo bài đọc. Thử /read lại.' : '❌ Error generating passage. Try /read again.');
    }
  });

  // Answer handler
  bot.action(/^reading_(\d+)_(\d+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const qIndex = parseInt(match[1]);
    const selected = parseInt(match[2]);

    const session = activeReadingSessions.get(telegramId);
    if (!session || qIndex !== session.currentQuestion) {
      await ctx.answerCbQuery(lang === 'vi' ? 'Đã hết hạn' : 'Expired');
      return;
    }

    const q = session.questions[qIndex];
    const isCorrect = selected === q.answer;
    if (isCorrect) session.correctCount++;
    session.currentQuestion++;

    const feedback = isCorrect
      ? `✅ ${lang === 'vi' ? 'Đúng!' : 'Correct!'}\n💡 ${q.explanation}`
      : `❌ ${lang === 'vi' ? 'Sai!' : 'Wrong!'} ${lang === 'vi' ? 'Đáp án đúng:' : 'Correct answer:'} *${q.options[q.answer]}*\n💡 ${q.explanation}`;

    await ctx.answerCbQuery(isCorrect ? '✅' : '❌');

    // Track mistakes
    if (!isCorrect) {
      const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
      if (user) {
        recordMistake(user.id, 'reading', q.question.substring(0, 200), q.options[selected], q.options[q.answer]);
      }
    }

    if (session.currentQuestion >= session.questions.length) {
      // Finished
      const pct = Math.round((session.correctCount / session.questions.length) * 100);
      const emoji = pct >= 75 ? '🌟' : pct >= 50 ? '💪' : '📚';
      const resultMsg = lang === 'vi'
        ? `${feedback}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📊 *KẾT QUẢ ĐỌC HIỂU:* ${session.correctCount}/${session.questions.length} (${pct}%)\n${emoji} ${pct >= 75 ? 'Xuất sắc!' : pct >= 50 ? 'Khá tốt!' : 'Cần luyện thêm!'}\n\n📌 Dùng /read để luyện thêm!`
        : `${feedback}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📊 *READING RESULTS:* ${session.correctCount}/${session.questions.length} (${pct}%)\n${emoji} ${pct >= 75 ? 'Excellent!' : pct >= 50 ? 'Good job!' : 'Keep practicing!'}\n\n📌 Use /read for more!`;
      await ctx.editMessageText(resultMsg, { parse_mode: 'Markdown' });
      activeReadingSessions.delete(telegramId);
    } else {
      await ctx.editMessageText(feedback, { parse_mode: 'Markdown' });
      await sendReadingQuestion(bot, telegramId, ctx.chat!.id);
    }
  });
}

async function sendReadingQuestion(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const session = activeReadingSessions.get(telegramId);
  if (!session) return;

  const q = session.questions[session.currentQuestion];
  const typeLabel: Record<string, string> = { TFNG: 'True/False/NG', MCQ: 'Multiple Choice', Fill: 'Vocabulary', Inference: 'Inference' };

  const msg = `📖 ${lang === 'vi' ? 'Câu' : 'Q'} ${session.currentQuestion + 1}/${session.questions.length} _(${typeLabel[q.type] || q.type})_\n\n${q.question}`;

  const buttons = q.options.map((opt: string, i: number) =>
    [Markup.button.callback(`${String.fromCharCode(65 + i)}. ${opt}`, `reading_${session.currentQuestion}_${i}`)]
  );

  await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
}
