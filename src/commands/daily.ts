import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { askAi } from '../services/ai_service';
import { recordMistake } from './mistakes';
import { getVietnamToday, getVietnamTomorrow, getVietnamYesterday, getVietnamDaysLater, shuffleArray } from '../utils/helpers';

const VOCAB_TOPICS = [
  'Environment & Climate Change', 'Technology & Innovation', 'Education & Learning',
  'Health & Wellbeing', 'Urbanisation & City Life', 'Globalisation & Trade',
  'Crime & Law', 'Media & Advertising', 'Art & Culture', 'Science & Research',
  'Travel & Tourism', 'Food & Agriculture', 'Politics & Government',
  'Space & Exploration', 'Psychology & Behaviour', 'Economics & Finance',
  'History & Heritage', 'Sport & Fitness', 'Family & Relationships',
  'Communication & Language', 'Work & Employment', 'Housing & Architecture',
  'Transport & Infrastructure', 'Energy & Sustainability', 'Fashion & Lifestyle',
  'Animals & Wildlife', 'Music & Entertainment', 'Philosophy & Ethics',
];

function pickRandomTopic(): string {
  return VOCAB_TOPICS[Math.floor(Math.random() * VOCAB_TOPICS.length)];
}

function randomStartingLetter(): string {
  const letters = 'ABCDEFGHIJKLMNOPRSTUVW';
  return letters[Math.floor(Math.random() * letters.length)];
}

const MAX_VOCAB_RETRIES = 3;

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

function saveLearnedItem(userId: number, type: string, word: string, meaningVi: string, meaningEn: string, example: string) {
  const today = getVietnamToday();
  const nextReview = getVietnamTomorrow();
  
  db.prepare(`
    INSERT INTO learned_items (user_id, type, word, meaning, meaning_vi, meaning_en, example, learned_date, next_review_date, mastery_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(userId, type, word, meaningVi, meaningVi, meaningEn, example, today, nextReview);

  updateStudyStreak(userId);
}

function updateStudyStreak(userId: number): void {
  const user = db.prepare('SELECT study_streak, last_study_date FROM users WHERE id = ?').get(userId) as any;
  if (!user) return;

  const today = getVietnamToday();
  if (user.last_study_date === today) return;

  const yesterdayStr = getVietnamYesterday();
  const newStreak = user.last_study_date === yesterdayStr ? (user.study_streak || 0) + 1 : 1;

  db.prepare(`UPDATE users SET study_streak = ?, last_study_date = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newStreak, today, userId);
}

function getCurrentLearningBand(user: any): number {
  const target = user.target_score || 7.0;
  if (!user.estimated_band) return target;
  
  const streak = user.study_streak || 0;
  // Increase by 0.5 band for every 3 days of consistent study
  const calculated = user.estimated_band + Math.floor(streak / 3) * 0.5;
  return Math.min(target, calculated);
}

export async function sendDailyVocab(bot: any, telegramId: string, chatId: string | number, topic?: string, _retryCount = 0): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id, target_score, estimated_band, study_streak FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  const band = getCurrentLearningBand(user);

  const effectiveTopic = topic || pickRandomTopic();

  if (_retryCount === 0) {
    const findingMsg = topic
      ? (lang === 'vi' ? `⏳ Đang tìm kiếm từ vựng IELTS chủ đề *${topic}* cho bạn...` : `⏳ Finding a great IELTS vocabulary about *${topic}* for you...`)
      : (lang === 'vi' ? `⏳ Đang tìm kiếm từ vựng IELTS chủ đề *${effectiveTopic}* cho bạn...` : `⏳ Finding a great IELTS vocabulary about *${effectiveTopic}* for you...`);
    await bot.telegram.sendMessage(chatId, findingMsg, { parse_mode: 'Markdown' });
  }

  const alreadyLearned = db.prepare(
    `SELECT word FROM learned_items WHERE user_id = ? AND type = 'vocab' ORDER BY learned_date DESC LIMIT 100`
  ).all(user.id) as any[];
  const excludeWords = alreadyLearned.map((r: any) => r.word).join(', ');
  const excludeInstruction = excludeWords
    ? `Do NOT use any of these words (the user already learned them): [${excludeWords}].`
    : '';

  const startLetter = randomStartingLetter();

  const prompt = `
    Generate 1 advanced IELTS vocabulary word suitable for band ${band}.
    The word MUST be related to the topic: "${effectiveTopic}".
    The word should start with the letter "${startLetter}" (if possible, otherwise pick any uncommon word).
    ${excludeInstruction}
    Be creative and pick a less common, surprising word — avoid generic choices.
    Format as JSON:
    {
      "word": "the word",
      "type": "noun/verb/adj",
      "phonetic": "pronunciation",
      "meaning_en": "English meaning",
      "meaning_vi": "Vietnamese meaning",
      "synonyms": ["synonym1", "synonym2"],
      "example_en": "Advanced IELTS-style example sentence",
      "example_vi": "Vietnamese translation of the example",
      "collocations": ["collocation 1", "collocation 2"]
    }
    Only return the JSON.
  `;

  try {
    const response = await askAi(prompt, undefined, 0.9);
    const data = JSON.parse(response || '{}');
    
    if (!data.word) throw new Error('Invalid JSON format');

    const duplicate = db.prepare(
      `SELECT id FROM learned_items WHERE user_id = ? AND type = 'vocab' AND LOWER(word) = LOWER(?)`
    ).get(user.id, data.word) as any;
    if (duplicate) {
      if (_retryCount < MAX_VOCAB_RETRIES) {
        return sendDailyVocab(bot, telegramId, chatId, topic, _retryCount + 1);
      }
      // Max retries reached — accept it and inform user
    }

    saveLearnedItem(user.id, 'vocab', data.word, data.meaning_vi, data.meaning_en, data.example_en);

    const msg = lang === 'vi'
      ? `📚 *TỪ VỰNG HÔM NAY* (Band ${band})\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 *${data.word}* (${data.type}) / ${data.phonetic} /\n\n📖 *Ý nghĩa:* ${data.meaning_vi}\n💡 *English:* ${data.meaning_en}\n\n🔄 *Từ đồng nghĩa:* ${data.synonyms.join(', ')}\n🔗 *Cụm từ thường đi kèm:* ${data.collocations.join(', ')}\n\n📝 *Ví dụ IELTS:*\n- ${data.example_en}\n- _(${data.example_vi})_\n\n_(Từ này đã được lưu lại để ôn tập cuối ngày)_`
      : `📚 *TODAY'S VOCABULARY* (Band ${band})\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 *${data.word}* (${data.type}) / ${data.phonetic} /\n\n📖 *Meaning:* ${data.meaning_en}\n\n🔄 *Synonyms:* ${data.synonyms.join(', ')}\n🔗 *Collocations:* ${data.collocations.join(', ')}\n\n📝 *IELTS Example:*\n- ${data.example_en}\n\n_(This word has been saved for end-of-day review)_`;

    await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await bot.telegram.sendMessage(chatId, lang === 'vi' ? '❌ Lỗi khi lấy từ vựng. Thử lại nhé.' : '❌ Error fetching vocab. Try again.');
  }
}

export async function sendDailyGrammar(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id, target_score, estimated_band, study_streak FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  const band = getCurrentLearningBand(user);

  await bot.telegram.sendMessage(chatId, lang === 'vi' ? '⏳ Đang soạn cấu trúc ngữ pháp...' : '⏳ Preparing a grammar structure...');

  const prompt = `
    Generate 1 advanced IELTS grammar structure suitable for band ${band} (e.g. Inversion, Mixed Conditionals, Cleft sentences, Participle clauses).
    Format as JSON:
    {
      "name": "Name of the structure",
      "formula": "Formula or structure rule",
      "usage_en": "When to use it in IELTS (English)",
      "usage_vi": "When to use it in IELTS (Vietnamese)",
      "example_en": "Example sentence for IELTS Writing/Speaking",
      "example_vi": "Vietnamese translation of the example"
    }
    Only return the JSON.
  `;

  try {
    const response = await askAi(prompt, undefined, 0.9);
    const data = JSON.parse(response || '{}');
    
    if (!data.name) throw new Error('Invalid JSON');

    saveLearnedItem(user.id, 'grammar', data.name, data.usage_vi, data.usage_en, data.example_en);

    const msg = lang === 'vi'
      ? `📝 *NGỮ PHÁP NÂNG CAO*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📌 *${data.name}*\n📐 *Cấu trúc:* \`${data.formula}\`\n\n💡 *Cách dùng (IELTS):* ${data.usage_vi}\n\n📝 *Ví dụ:*\n- ${data.example_en}\n- _(${data.example_vi})_\n\n_(Cấu trúc này đã được lưu lại để ôn tập)_`
      : `📝 *ADVANCED GRAMMAR*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📌 *${data.name}*\n📐 *Formula:* \`${data.formula}\`\n\n💡 *IELTS Usage:* ${data.usage_en}\n\n📝 *Example:*\n- ${data.example_en}\n\n_(This structure has been saved for review)_`;

    await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await bot.telegram.sendMessage(chatId, lang === 'vi' ? '❌ Lỗi khi lấy ngữ pháp. Thử lại nhé.' : '❌ Error fetching grammar. Try again.');
  }
}

export async function sendDailyPhrase(bot: any, telegramId: string, chatId: string | number, topic?: string): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id, target_score, estimated_band, study_streak FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  const band = getCurrentLearningBand(user);

  const findingMsg = topic 
    ? (lang === 'vi' ? `⏳ Đang lấy cụm từ/thành ngữ chủ đề *${topic}*...` : `⏳ Fetching phrase/idiom about *${topic}*...`)
    : (lang === 'vi' ? '⏳ Đang lấy cụm từ/thành ngữ...' : '⏳ Fetching phrase/idiom...');
  await bot.telegram.sendMessage(chatId, findingMsg, { parse_mode: 'Markdown' });

  const topicInstruction = topic ? `The phrase/idiom MUST be strictly related to the topic: "${topic}".` : '';

  const alreadyLearnedPhrases = db.prepare(
    `SELECT word FROM learned_items WHERE user_id = ? AND type = 'phrase' ORDER BY learned_date DESC LIMIT 50`
  ).all(user.id) as any[];
  const excludePhrases = alreadyLearnedPhrases.map((r: any) => r.word).join(', ');
  const excludePhraseInstruction = excludePhrases
    ? `Do NOT use any of these phrases (already learned): [${excludePhrases}].`
    : '';

  const prompt = `
    Generate 1 useful IELTS phrase, idiom, or phrasal verb suitable for band ${band}.
    ${topicInstruction}
    ${excludePhraseInstruction}
    Format as JSON:
    {
      "phrase": "the phrase",
      "meaning_en": "English meaning",
      "meaning_vi": "Vietnamese meaning",
      "context": "Context where it is best used (e.g. Speaking Part 1, Writing Task 2)",
      "example_en": "Example sentence",
      "example_vi": "Vietnamese translation of the example"
    }
    Only return the JSON.
  `;

  try {
    const response = await askAi(prompt, undefined, 0.9);
    const data = JSON.parse(response || '{}');
    
    if (!data.phrase) throw new Error('Invalid JSON');

    saveLearnedItem(user.id, 'phrase', data.phrase, data.meaning_vi, data.meaning_en, data.example_en);

    const msg = lang === 'vi'
      ? `💬 *CỤM TỪ / THÀNH NGỮ*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *${data.phrase}*\n\n📖 *Ý nghĩa:* ${data.meaning_vi}\n🎯 *Áp dụng:* ${data.context}\n\n📝 *Ví dụ:*\n- ${data.example_en}\n- _(${data.example_vi})_\n\n_(Cụm từ này đã được lưu lại để ôn tập)_`
      : `💬 *PHRASE / IDIOM*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *${data.phrase}*\n\n📖 *Meaning:* ${data.meaning_en}\n🎯 *Context:* ${data.context}\n\n📝 *Example:*\n- ${data.example_en}\n\n_(This phrase has been saved for review)_`;

    await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await bot.telegram.sendMessage(chatId, lang === 'vi' ? '❌ Lỗi khi lấy cụm từ. Thử lại nhé.' : '❌ Error fetching phrase. Try again.');
  }
}

// In-memory state for review quizzes
const activeReviewQuizzes = new Map<string, {
  items: any[];
  currentIndex: number;
  correctCount: number;
}>();

export async function sendDailyReview(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  const today = getVietnamToday();

  const todayItems = db.prepare(
    'SELECT * FROM learned_items WHERE user_id = ? AND learned_date = ?'
  ).all(user.id, today) as any[];

  const srsItems = db.prepare(
    'SELECT * FROM learned_items WHERE user_id = ? AND next_review_date <= ? AND mastery_level < 5 AND learned_date != ? ORDER BY next_review_date ASC LIMIT 10'
  ).all(user.id, today, today) as any[];

  const seenIds = new Set(todayItems.map((i: any) => i.id));
  const combined = [...todayItems];
  for (const item of srsItems) {
    if (!seenIds.has(item.id)) combined.push(item);
  }
  const items = shuffleArray(combined);

  if (items.length === 0) {
    await bot.telegram.sendMessage(chatId, lang === 'vi' 
      ? '📭 Hôm nay bạn chưa học từ mới hay ngữ pháp nào. Dùng lệnh /vocab, /grammar, hoặc /phrase để học nhé!' 
      : "📭 You haven't learned any new items today. Use /vocab, /grammar, or /phrase to start learning!");
    return;
  }

  activeReviewQuizzes.set(telegramId, { items, currentIndex: 0, correctCount: 0 });

  const intro = lang === 'vi'
    ? `🧠 *ÔN TẬP CUỐI NGÀY*\n━━━━━━━━━━━━━━━━━━━━━━\nHôm nay bạn đã học *${items.length}* kiến thức mới.\nHãy trả lời đúng nghĩa của chúng nhé!`
    : `🧠 *END OF DAY REVIEW*\n━━━━━━━━━━━━━━━━━━━━━━\nYou learned *${items.length}* new items today.\nLet's quiz your memory!`;

  await bot.telegram.sendMessage(chatId, intro, { parse_mode: 'Markdown' });
  await sendReviewQuestion(bot, telegramId, chatId);
}

async function sendReviewQuestion(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const quiz = activeReviewQuizzes.get(telegramId);
  if (!quiz) return;

  const item = quiz.items[quiz.currentIndex];
  const icon = item.type === 'vocab' ? '🎯' : item.type === 'grammar' ? '📌' : '🔥';

  const meaningCol = lang === 'vi' ? 'meaning_vi' : 'meaning_en';
  const correctAnswer = (lang === 'vi' ? item.meaning_vi : item.meaning_en) || item.meaning;
  const options = new Set<string>([correctAnswer]);

  const otherItems = db.prepare(
    `SELECT DISTINCT COALESCE(${meaningCol}, meaning) as m FROM learned_items
     WHERE user_id = (SELECT id FROM users WHERE telegram_id = ?)
       AND COALESCE(${meaningCol}, meaning) != ? AND id != ?
     ORDER BY RANDOM() LIMIT 6`
  ).all(telegramId, correctAnswer, item.id) as any[];

  for (const other of otherItems) {
    if (options.size >= 4) break;
    if (other.m && other.m.trim().toLowerCase() !== correctAnswer.trim().toLowerCase()) {
      options.add(other.m);
    }
  }

  const fallbacks = lang === 'vi'
    ? ['(không rõ nghĩa)', 'làm cho tệ hơn', 'một loại động vật', 'rất nhanh chóng']
    : ['(no clear meaning)', 'to make worse', 'a type of animal', 'very quickly'];
  let fbIdx = 0;
  while (options.size < 4 && fbIdx < fallbacks.length) {
    options.add(fallbacks[fbIdx++]);
  }

  const shuffled = shuffleArray([...options]);
  const correctIndex = shuffled.indexOf(correctAnswer);

  const msg = `${icon} ${lang === 'vi' ? 'Câu' : 'Q'} ${quiz.currentIndex + 1}/${quiz.items.length}\n\n*${item.word}* ${lang === 'vi' ? 'có nghĩa là gì?' : 'means what?'}`;

  const buttons = shuffled.map((opt: string, i: number) =>
    [Markup.button.callback(
      `${String.fromCharCode(65 + i)}. ${opt.substring(0, 50)}`,
      `rv_${quiz.currentIndex}_${i === correctIndex ? 1 : 0}`
    )]
  );

  await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
}

export function registerDailyCommands(bot: any): void {
  bot.command('vocab', async (ctx: Context) => {
    const text = (ctx.message as any)?.text || '';
    const topic = text.replace('/vocab', '').trim();
    
    if (!topic) {
      const lang = getUserLang(ctx.from!.id.toString());
      const msg = lang === 'vi' ? 'Lựa chọn chủ đề để học từ vựng hôm nay:' : "Select a topic for today's vocabulary:";
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🌍 Environment', 'vocab_topic_Environment'), Markup.button.callback('💻 Technology', 'vocab_topic_Technology')],
        [Markup.button.callback('📚 Education', 'vocab_topic_Education'), Markup.button.callback('💼 Work', 'vocab_topic_Work')],
        [Markup.button.callback('🏥 Health', 'vocab_topic_Health'), Markup.button.callback('🎨 Art & Culture', 'vocab_topic_Art')],
        [Markup.button.callback('🎲 Random', 'vocab_topic_Random')]
      ]);
      await ctx.reply(msg, keyboard);
      return;
    }
    await sendDailyVocab(bot, ctx.from!.id.toString(), ctx.chat!.id, topic);
  });

  bot.action(/vocab_topic_(.+)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const topic = (ctx as any).match[1];
    const actualTopic = topic === 'Random' ? undefined : topic;
    await sendDailyVocab(bot, ctx.from!.id.toString(), ctx.chat!.id, actualTopic);
  });

  bot.command('grammar', async (ctx: Context) => {
    await sendDailyGrammar(bot, ctx.from!.id.toString(), ctx.chat!.id);
  });

  bot.command('phrase', async (ctx: Context) => {
    const text = (ctx.message as any)?.text || '';
    const topic = text.replace('/phrase', '').trim();
    
    if (!topic) {
      const lang = getUserLang(ctx.from!.id.toString());
      const msg = lang === 'vi' ? 'Lựa chọn ngữ cảnh cho cụm từ/idiom:' : 'Select a context for the phrase/idiom:';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🗣 Speaking Part 1', 'phrase_topic_Speaking Part 1'), Markup.button.callback('🎤 Speaking Part 3', 'phrase_topic_Speaking Part 3')],
        [Markup.button.callback('✍️ Writing Task 2', 'phrase_topic_Writing Task 2'), Markup.button.callback('✉️ Formal Letter', 'phrase_topic_Formal Letter')],
        [Markup.button.callback('🎲 Random', 'phrase_topic_Random')]
      ]);
      await ctx.reply(msg, keyboard);
      return;
    }
    await sendDailyPhrase(bot, ctx.from!.id.toString(), ctx.chat!.id, topic);
  });

  bot.action(/phrase_topic_(.+)/, async (ctx: Context) => {
    await ctx.answerCbQuery();
    const topic = (ctx as any).match[1];
    const actualTopic = topic === 'Random' ? undefined : topic;
    await sendDailyPhrase(bot, ctx.from!.id.toString(), ctx.chat!.id, actualTopic);
  });

  bot.command('review', async (ctx: Context) => {
    await sendDailyReview(bot, ctx.from!.id.toString(), ctx.chat!.id);
  });

  // Review quiz answer handler (rv_<qIndex>_<1=correct|0=wrong>)
  bot.action(/^rv_(\d+)_([01])$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const qIndex = parseInt(match[1]);
    const isCorrect = match[2] === '1';

    const quiz = activeReviewQuizzes.get(telegramId);
    if (!quiz || qIndex !== quiz.currentIndex) {
      await ctx.answerCbQuery(lang === 'vi' ? 'Đã hết hạn' : 'Expired');
      return;
    }

    if (isCorrect) quiz.correctCount++;
    quiz.currentIndex++;

    const item = quiz.items[qIndex];
    const displayMeaning = (lang === 'vi' ? item.meaning_vi : item.meaning_en) || item.meaning;
    const feedback = isCorrect
      ? `✅ *${item.word}* = ${displayMeaning}`
      : `❌ *${item.word}* = ${displayMeaning}`;

    // Update SRS data
    const srsIntervals = [1, 3, 7, 14, 30];
    if (isCorrect) {
      const newMastery = Math.min((item.mastery_level || 0) + 1, 5);
      const nextDays = srsIntervals[Math.min(newMastery, srsIntervals.length - 1)];
      const nextReview = getVietnamDaysLater(nextDays);
      db.prepare(
        `UPDATE learned_items SET mastery_level = ?, next_review_date = ?, review_count = review_count + 1 WHERE id = ?`
      ).run(newMastery, nextReview, item.id);
    } else {
      db.prepare(
        `UPDATE learned_items SET mastery_level = 0, next_review_date = ?, review_count = review_count + 1 WHERE id = ?`
      ).run(getVietnamTomorrow(), item.id);
      const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
      if (user) {
        recordMistake(user.id, item.type || 'vocab', `What is the meaning of "${item.word}"?`, '(wrong option)', item.meaning);
      }
    }

    await ctx.answerCbQuery(isCorrect ? '✅' : '❌');

    if (quiz.currentIndex >= quiz.items.length) {
      const pct = Math.round((quiz.correctCount / quiz.items.length) * 100);
      const emoji = pct >= 80 ? '🌟' : pct >= 60 ? '💪' : '📚';
      const resultMsg = lang === 'vi'
        ? `${feedback}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📊 *KẾT QUẢ ÔN TẬP:* ${quiz.correctCount}/${quiz.items.length} (${pct}%)\n${emoji} ${pct >= 80 ? 'Xuất sắc! Bạn nhớ rất tốt!' : pct >= 60 ? 'Khá tốt! Cần ôn thêm chút nữa!' : 'Cần ôn tập nhiều hơn!'}\n\n💡 Dùng /vocab để học thêm từ mới!`
        : `${feedback}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📊 *REVIEW RESULTS:* ${quiz.correctCount}/${quiz.items.length} (${pct}%)\n${emoji} ${pct >= 80 ? 'Excellent memory!' : pct >= 60 ? 'Good, review a bit more!' : 'Need more practice!'}\n\n💡 Use /vocab to learn more!`;
      await ctx.editMessageText(resultMsg, { parse_mode: 'Markdown' });
      activeReviewQuizzes.delete(telegramId);
    } else {
      await ctx.editMessageText(feedback, { parse_mode: 'Markdown' });
      await sendReviewQuestion(bot, telegramId, ctx.chat!.id);
    }
  });
}
