import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { askAi } from '../services/ai_service';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

const speakingPart1Topics = [
  'Work or Study', 'Hometown', 'Accommodation', 'Hobbies', 'Music',
  'Reading', 'Sports', 'Food & Cooking', 'Weather', 'Transport',
  'Technology', 'Social Media', 'Shopping', 'Movies', 'Travel',
];

const speakingPart2Topics = [
  { topic: 'Describe a book that you have recently read', points: ['What the book was', 'When you read it', 'What it was about', 'Why you enjoyed it'] },
  { topic: 'Describe a person who has influenced you', points: ['Who this person is', 'How you know them', 'What they did', 'Why they influenced you'] },
  { topic: 'Describe a place you would like to visit', points: ['Where it is', 'How you know about it', 'What you would do there', 'Why you want to visit'] },
  { topic: 'Describe a skill you learned as a child', points: ['What the skill was', 'How you learned it', 'Who taught you', 'How it has helped you'] },
  { topic: 'Describe a time when you helped someone', points: ['Who you helped', 'What the situation was', 'How you helped', 'How you felt afterwards'] },
  { topic: 'Describe a piece of technology you find useful', points: ['What it is', 'How you use it', 'How long you have had it', 'Why it is useful to you'] },
  { topic: 'Describe an important decision you made', points: ['What the decision was', 'When you made it', 'How you made it', 'Why it was important'] },
  { topic: 'Describe a festival or celebration in your country', points: ['What festival it is', 'When it takes place', 'What people do', 'Why it is important'] },
  { topic: 'Describe a goal you have for the future', points: ['What the goal is', 'When you set it', 'What you are doing to achieve it', 'Why it is important to you'] },
  { topic: 'Describe an environmental problem in your area', points: ['What the problem is', 'What causes it', 'How it affects people', 'What can be done'] },
];

const speakingPart3Questions: Record<string, string[]> = {
  'education': ['Do you think the education system in your country is effective?', 'How has technology changed the way students learn?', 'Should university education be free for everyone?'],
  'technology': ['How has technology changed the way people communicate?', 'Do you think people are too dependent on technology?', 'What are the advantages and disadvantages of artificial intelligence?'],
  'environment': ['What can individuals do to protect the environment?', 'Do you think governments are doing enough to address climate change?', 'How important is environmental education for children?'],
  'work': ['What factors do people consider when choosing a career?', 'Is work-life balance achievable in modern society?', 'How will automation affect employment in the future?'],
  'society': ['What are the advantages of living in a multicultural society?', 'Do you think social media has a positive or negative impact on society?', 'How important is volunteering for communities?'],
};

export function registerSpeakCommand(bot: any): void {
  bot.command('speak', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const msg = lang === 'vi'
      ? '🗣️ *LUYỆN NÓI IELTS SPEAKING*\n━━━━━━━━━━━━━━━━━━━━━━\nChọn phần bạn muốn luyện:'
      : '🗣️ *IELTS SPEAKING PRACTICE*\n━━━━━━━━━━━━━━━━━━━━━━\nSelect the part you want to practice:';

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🗣️ Part 1 — Interview', 'speak_part1')],
        [Markup.button.callback('🎤 Part 2 — Cue Card (Long Turn)', 'speak_part2')],
        [Markup.button.callback('💬 Part 3 — Discussion', 'speak_part3')],
      ])
    });
  });

  // Part 1
  bot.action('speak_part1', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    await ctx.answerCbQuery();

    const topic = speakingPart1Topics[Math.floor(Math.random() * speakingPart1Topics.length)];
    const user = db.prepare('SELECT target_score, estimated_band FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const band = user?.target_score || 7.0;

    const prompt = `Generate 4 IELTS Speaking Part 1 questions about "${topic}". 
Then provide a model answer for EACH question targeting band ${band}.
Return as JSON:
{
  "topic": "${topic}",
  "questions": [
    {"q": "question text", "sample_answer": "A natural, fluent sample answer (2-3 sentences)", "useful_vocab": ["word1", "word2"]}
  ]
}
Only return JSON.`;

    await ctx.editMessageText(lang === 'vi' ? `⏳ Đang chuẩn bị câu hỏi Speaking Part 1 chủ đề *${topic}*...` : `⏳ Preparing Speaking Part 1 questions on *${topic}*...`, { parse_mode: 'Markdown' });

    try {
      const response = await askAi(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      const data = JSON.parse(jsonMatch[0]);

      let msg = lang === 'vi'
        ? `🗣️ *SPEAKING PART 1: ${data.topic}*\n━━━━━━━━━━━━━━━━━━━━━━\n_Trả lời mỗi câu hỏi trong 20-30 giây_\n\n`
        : `🗣️ *SPEAKING PART 1: ${data.topic}*\n━━━━━━━━━━━━━━━━━━━━━━\n_Answer each question in 20-30 seconds_\n\n`;

      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        msg += `*Q${i + 1}:* ${q.q}\n`;
        msg += `💡 *Sample:* _${q.sample_answer}_\n`;
        msg += `📚 *Vocab:* ${q.useful_vocab.join(', ')}\n\n`;
      }

      msg += lang === 'vi' ? '━━━━━━━━━━━━━━━━━━━━━━\n💡 _Hãy tự trả lời trước rồi mới xem sample!_' : '━━━━━━━━━━━━━━━━━━━━━━\n💡 _Try answering first, then check the samples!_';

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error(e);
      await ctx.reply(lang === 'vi' ? '❌ Lỗi khi tạo câu hỏi. Thử /speak lại.' : '❌ Error generating questions. Try /speak again.');
    }
  });

  // Part 2 — Cue Card
  bot.action('speak_part2', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    await ctx.answerCbQuery();

    const cueCard = speakingPart2Topics[Math.floor(Math.random() * speakingPart2Topics.length)];
    const user = db.prepare('SELECT target_score FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const band = user?.target_score || 7.0;

    const pointsFormatted = cueCard.points.map((p, i) => `  • ${p}`).join('\n');

    const cueMsg = lang === 'vi'
      ? `🎤 *SPEAKING PART 2 — CUE CARD*
━━━━━━━━━━━━━━━━━━━━━━

📝 *${cueCard.topic}*

You should say:
${pointsFormatted}

And explain why.

━━━━━━━━━━━━━━━━━━━━━━
⏱️ *1 phút chuẩn bị, 2 phút nói*

_Khi sẵn sàng, bấm nút bên dưới để xem sample answer._`
      : `🎤 *SPEAKING PART 2 — CUE CARD*
━━━━━━━━━━━━━━━━━━━━━━

📝 *${cueCard.topic}*

You should say:
${pointsFormatted}

And explain why.

━━━━━━━━━━━━━━━━━━━━━━
⏱️ *1 minute to prepare, 2 minutes to speak*

_When ready, press the button below to see the sample answer._`;

    await ctx.editMessageText(cueMsg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'vi' ? '👀 Xem Sample Answer' : '👀 Show Sample Answer', `speak_p2_sample_${speakingPart2Topics.indexOf(cueCard)}`)]
      ])
    });
  });

  // Part 2 Sample Answer
  bot.action(/^speak_p2_sample_(\d+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const index = parseInt(match[1]);
    const cueCard = speakingPart2Topics[index] || speakingPart2Topics[0];
    await ctx.answerCbQuery();

    const user = db.prepare('SELECT target_score FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const band = user?.target_score || 7.0;

    const prompt = `Generate a model IELTS Speaking Part 2 answer for this cue card targeting band ${band}:
Topic: "${cueCard.topic}"
Points to cover: ${cueCard.points.join(', ')}

Return as JSON:
{
  "sample_answer": "A natural, fluent 180-220 word answer covering all points",
  "key_vocabulary": ["advanced word 1", "advanced word 2", "advanced word 3", "advanced word 4"],
  "useful_phrases": ["phrase 1", "phrase 2", "phrase 3"],
  "tips": ["tip for this type of cue card"]
}
Only return JSON.`;

    await ctx.editMessageText(lang === 'vi' ? '⏳ Đang tạo sample answer...' : '⏳ Generating sample answer...');

    try {
      const response = await askAi(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      const data = JSON.parse(jsonMatch[0]);

      const msg = lang === 'vi'
        ? `🎤 *SAMPLE ANSWER (Band ${band})*
━━━━━━━━━━━━━━━━━━━━━━

📝 *${cueCard.topic}*

💬 _${data.sample_answer}_

📚 *Từ vựng nổi bật:* ${data.key_vocabulary.join(', ')}

🔗 *Cụm từ hay:* ${data.useful_phrases.join(' | ')}

💡 *Mẹo:* ${data.tips[0]}

━━━━━━━━━━━━━━━━━━━━━━
📌 Dùng /speak để luyện thêm!`
        : `🎤 *SAMPLE ANSWER (Band ${band})*
━━━━━━━━━━━━━━━━━━━━━━

📝 *${cueCard.topic}*

💬 _${data.sample_answer}_

📚 *Key Vocabulary:* ${data.key_vocabulary.join(', ')}

🔗 *Useful Phrases:* ${data.useful_phrases.join(' | ')}

💡 *Tip:* ${data.tips[0]}

━━━━━━━━━━━━━━━━━━━━━━
📌 Use /speak for more practice!`;

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error(e);
      await ctx.reply(lang === 'vi' ? '❌ Lỗi tạo sample answer.' : '❌ Error generating sample answer.');
    }
  });

  // Part 3
  bot.action('speak_part3', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    await ctx.answerCbQuery();

    const topics = Object.keys(speakingPart3Questions);
    const buttons = topics.map(t => [Markup.button.callback(
      t.charAt(0).toUpperCase() + t.slice(1),
      `speak_p3_${t}`
    )]);
    buttons.push([Markup.button.callback(lang === 'vi' ? '🎲 Ngẫu nhiên' : '🎲 Random', 'speak_p3_random')]);

    await ctx.editMessageText(
      lang === 'vi' ? '💬 Chọn chủ đề Part 3:' : '💬 Select Part 3 topic:',
      Markup.inlineKeyboard(buttons)
    );
  });

  bot.action(/^speak_p3_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    let topicKey = match[1];
    await ctx.answerCbQuery();

    const topics = Object.keys(speakingPart3Questions);
    if (topicKey === 'random') {
      topicKey = topics[Math.floor(Math.random() * topics.length)];
    }

    const questions = speakingPart3Questions[topicKey] || speakingPart3Questions[topics[0]];
    const user = db.prepare('SELECT target_score FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const band = user?.target_score || 7.0;

    const prompt = `For each of these IELTS Speaking Part 3 questions about "${topicKey}", provide a model answer targeting band ${band}:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Return as JSON:
{
  "topic": "${topicKey}",
  "answers": [
    {"question": "...", "sample_answer": "Natural 3-4 sentence answer with examples", "advanced_vocab": ["word1", "word2"]}
  ]
}
Only return JSON.`;

    await ctx.editMessageText(lang === 'vi' ? '⏳ Đang chuẩn bị Part 3...' : '⏳ Preparing Part 3...');

    try {
      const response = await askAi(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      const data = JSON.parse(jsonMatch[0]);

      let msg = lang === 'vi'
        ? `💬 *SPEAKING PART 3: ${data.topic.toUpperCase()}*\n━━━━━━━━━━━━━━━━━━━━━━\n_Đây là phần thảo luận chuyên sâu. Hãy đưa ra ý kiến + giải thích + ví dụ._\n\n`
        : `💬 *SPEAKING PART 3: ${data.topic.toUpperCase()}*\n━━━━━━━━━━━━━━━━━━━━━━\n_This is the discussion section. Give opinion + explanation + examples._\n\n`;

      for (let i = 0; i < data.answers.length; i++) {
        const a = data.answers[i];
        msg += `*Q${i + 1}:* ${a.question}\n`;
        msg += `💡 *Sample:* _${a.sample_answer}_\n`;
        msg += `📚 ${a.advanced_vocab.join(', ')}\n\n`;
      }

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error(e);
      await ctx.reply(lang === 'vi' ? '❌ Lỗi tạo câu hỏi Part 3.' : '❌ Error generating Part 3.');
    }
  });
}
