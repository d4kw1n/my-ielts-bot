import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { askAi } from '../services/ai_service';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

function saveLearnedItem(userId: number, type: string, word: string, meaning: string, example: string) {
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO learned_items (user_id, type, word, meaning, example, learned_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, type, word, meaning, example, today);
}

export async function sendDailyVocab(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id, target_score FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  const band = user.target_score || 7.0;

  await bot.telegram.sendMessage(chatId, lang === 'vi' ? '⏳ Đang tìm kiếm từ vựng IELTS hay cho bạn...' : '⏳ Finding a great IELTS vocabulary for you...');

  const prompt = \`
    Generate 1 advanced IELTS vocabulary word suitable for band \${band}.
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
  \`;

  try {
    const response = await askAi(prompt);
    const data = JSON.parse(response || '{}');
    
    if (!data.word) throw new Error('Invalid JSON format');

    saveLearnedItem(user.id, 'vocab', data.word, lang === 'vi' ? data.meaning_vi : data.meaning_en, data.example_en);

    const msg = lang === 'vi'
      ? \`📚 *TỪ VỰNG HÔM NAY* (Band \${band})\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 *\${data.word}* (\${data.type}) / \${data.phonetic} /\n\n📖 *Ý nghĩa:* \${data.meaning_vi}\n💡 *English:* \${data.meaning_en}\n\n🔄 *Từ đồng nghĩa:* \${data.synonyms.join(', ')}\n🔗 *Cụm từ thường đi kèm:* \${data.collocations.join(', ')}\n\n📝 *Ví dụ IELTS:*\n- \${data.example_en}\n- _(\${data.example_vi})_\n\n_(Từ này đã được lưu lại để ôn tập cuối ngày)_\`
      : \`📚 *TODAY'S VOCABULARY* (Band \${band})\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 *\${data.word}* (\${data.type}) / \${data.phonetic} /\n\n📖 *Meaning:* \${data.meaning_en}\n\n🔄 *Synonyms:* \${data.synonyms.join(', ')}\n🔗 *Collocations:* \${data.collocations.join(', ')}\n\n📝 *IELTS Example:*\n- \${data.example_en}\n\n_(This word has been saved for end-of-day review)_\`;

    await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await bot.telegram.sendMessage(chatId, lang === 'vi' ? '❌ Lỗi khi lấy từ vựng. Thử lại nhé.' : '❌ Error fetching vocab. Try again.');
  }
}

export function registerDailyCommands(bot: any): void {
  bot.command('vocab', async (ctx: Context) => {
    await sendDailyVocab(bot, ctx.from!.id.toString(), ctx.chat!.id);
  });

export async function sendDailyGrammar(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  await bot.telegram.sendMessage(chatId, lang === 'vi' ? '⏳ Đang soạn cấu trúc ngữ pháp...' : '⏳ Preparing a grammar structure...');

  const prompt = \`
    Generate 1 advanced IELTS grammar structure (e.g. Inversion, Mixed Conditionals, Cleft sentences, Participle clauses).
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
  \`;

  try {
    const response = await askAi(prompt);
    const data = JSON.parse(response || '{}');
    
    if (!data.name) throw new Error('Invalid JSON');

    saveLearnedItem(user.id, 'grammar', data.name, lang === 'vi' ? data.usage_vi : data.usage_en, data.example_en);

    const msg = lang === 'vi'
      ? \`📝 *NGỮ PHÁP NÂNG CAO*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📌 *\${data.name}*\n📐 *Cấu trúc:* \`\${data.formula}\`\n\n💡 *Cách dùng (IELTS):* \${data.usage_vi}\n\n📝 *Ví dụ:*\n- \${data.example_en}\n- _(\${data.example_vi})_\n\n_(Cấu trúc này đã được lưu lại để ôn tập)_\`
      : \`📝 *ADVANCED GRAMMAR*\n━━━━━━━━━━━━━━━━━━━━━━\n\n📌 *\${data.name}*\n📐 *Formula:* \`\${data.formula}\`\n\n💡 *IELTS Usage:* \${data.usage_en}\n\n📝 *Example:*\n- \${data.example_en}\n\n_(This structure has been saved for review)_\`;

    await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await bot.telegram.sendMessage(chatId, lang === 'vi' ? '❌ Lỗi khi lấy ngữ pháp. Thử lại nhé.' : '❌ Error fetching grammar. Try again.');
  }
}

export async function sendDailyPhrase(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  await bot.telegram.sendMessage(chatId, lang === 'vi' ? '⏳ Đang lấy cụm từ/thành ngữ...' : '⏳ Fetching phrase/idiom...');

  const prompt = \`
    Generate 1 useful IELTS phrase, idiom, or phrasal verb.
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
  \`;

  try {
    const response = await askAi(prompt);
    const data = JSON.parse(response || '{}');
    
    if (!data.phrase) throw new Error('Invalid JSON');

    saveLearnedItem(user.id, 'phrase', data.phrase, lang === 'vi' ? data.meaning_vi : data.meaning_en, data.example_en);

    const msg = lang === 'vi'
      ? \`💬 *CỤM TỪ / THÀNH NGỮ*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *\${data.phrase}*\n\n📖 *Ý nghĩa:* \${data.meaning_vi}\n🎯 *Áp dụng:* \${data.context}\n\n📝 *Ví dụ:*\n- \${data.example_en}\n- _(\${data.example_vi})_\n\n_(Cụm từ này đã được lưu lại để ôn tập)_\`
      : \`💬 *PHRASE / IDIOM*\n━━━━━━━━━━━━━━━━━━━━━━\n\n🔥 *\${data.phrase}*\n\n📖 *Meaning:* \${data.meaning_en}\n🎯 *Context:* \${data.context}\n\n📝 *Example:*\n- \${data.example_en}\n\n_(This phrase has been saved for review)_\`;

    await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error(e);
    await bot.telegram.sendMessage(chatId, lang === 'vi' ? '❌ Lỗi khi lấy cụm từ. Thử lại nhé.' : '❌ Error fetching phrase. Try again.');
  }
}

export async function sendDailyReview(bot: any, telegramId: string, chatId: string | number): Promise<void> {
  const lang = getUserLang(telegramId);
  const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];
  const items = db.prepare('SELECT * FROM learned_items WHERE user_id = ? AND learned_date = ?').all(user.id, today) as any[];

  if (items.length === 0) {
    await bot.telegram.sendMessage(chatId, lang === 'vi' 
      ? '📭 Hôm nay bạn chưa học từ mới hay ngữ pháp nào. Dùng lệnh /vocab, /grammar, hoặc /phrase để học nhé!' 
      : '📭 You haven\\'t learned any new items today. Use /vocab, /grammar, or /phrase to start learning!');
    return;
  }

  let msg = lang === 'vi' 
    ? \`🧠 *ÔN TẬP CUỐI NGÀY*\n━━━━━━━━━━━━━━━━━━━━━━\nHôm nay bạn đã học \${items.length} kiến thức mới:\n\n\`
    : \`🧠 *END OF DAY REVIEW*\n━━━━━━━━━━━━━━━━━━━━━━\nYou learned \${items.length} new items today:\n\n\`;

  for (let i = 0; i < items.length; i++) {
    const icon = items[i].type === 'vocab' ? '🎯' : items[i].type === 'grammar' ? '📌' : '🔥';
    msg += \`\${i + 1}. \${icon} *\${items[i].word}*\n   📖 \${items[i].meaning}\n\`;
  }

  msg += lang === 'vi' ? '\n💪 Hãy cố gắng nhẩm lại ví dụ của chúng trước khi đi ngủ nhé!' : '\n💪 Try to recall their examples before going to sleep!';
  await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

export function registerDailyCommands(bot: any): void {
  bot.command('vocab', async (ctx: Context) => {
    await sendDailyVocab(bot, ctx.from!.id.toString(), ctx.chat!.id);
  });

  bot.command('grammar', async (ctx: Context) => {
    await sendDailyGrammar(bot, ctx.from!.id.toString(), ctx.chat!.id);
  });

  bot.command('phrase', async (ctx: Context) => {
    await sendDailyPhrase(bot, ctx.from!.id.toString(), ctx.chat!.id);
  });

  bot.command('review', async (ctx: Context) => {
    await sendDailyReview(bot, ctx.from!.id.toString(), ctx.chat!.id);
  });
}
