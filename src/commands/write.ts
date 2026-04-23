import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { askAi } from '../services/ai_service';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

// In-memory state for writing sessions
const activeWritingSessions = new Map<string, {
  topic: string;
  taskType: string;
  waitingForEssay: boolean;
}>();

const writingTopics = [
  { id: 'env', en: 'Some people believe that the best way to reduce pollution is to increase the cost of fuel. To what extent do you agree or disagree?', vi: 'Một số người cho rằng cách tốt nhất để giảm ô nhiễm là tăng giá nhiên liệu. Bạn đồng ý hay không?' },
  { id: 'edu', en: 'Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think the true function of a university should be to give access to knowledge for its own sake. Discuss both views and give your opinion.', vi: 'Một số người cho rằng đại học nên cung cấp kiến thức và kỹ năng cần thiết cho công việc. Người khác cho rằng chức năng thực sự của đại học là cung cấp kiến thức vì chính nó. Thảo luận cả hai quan điểm và đưa ra ý kiến của bạn.' },
  { id: 'tech', en: 'In many countries, the use of mobile phones in public places is considered antisocial. However, some people believe it is a personal right. Discuss both views and give your opinion.', vi: 'Ở nhiều nước, sử dụng điện thoại di động ở nơi công cộng bị coi là thiếu ý thức. Tuy nhiên, một số người cho rằng đó là quyền cá nhân. Thảo luận cả hai quan điểm.' },
  { id: 'health', en: 'The prevention of health problems and illness is more important than treatment and medicine. Government funding should reflect this. To what extent do you agree?', vi: 'Phòng bệnh quan trọng hơn chữa bệnh. Ngân sách chính phủ nên phản ánh điều này. Bạn đồng ý ở mức nào?' },
  { id: 'work', en: 'Some people believe that it is better to have a job for life. Others think it is better to change jobs frequently. Discuss both views and give your opinion.', vi: 'Một số người tin rằng tốt hơn là có một công việc cả đời. Người khác cho rằng nên thay đổi công việc thường xuyên. Thảo luận và đưa ra ý kiến.' },
  { id: 'society', en: 'In some countries, an increasing number of people are choosing to live alone. Is this a positive or negative development?', vi: 'Ở một số nước, ngày càng nhiều người chọn sống một mình. Đây là xu hướng tích cực hay tiêu cực?' },
];

export function registerWriteCommand(bot: any): void {
  bot.command('write', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const msg = lang === 'vi'
      ? '✍️ *LUYỆN VIẾT IELTS TASK 2*\n━━━━━━━━━━━━━━━━━━━━━━\nChọn một đề bài bên dưới hoặc gõ `/write <đề bài tùy chỉnh>`:'
      : '✍️ *IELTS WRITING TASK 2 PRACTICE*\n━━━━━━━━━━━━━━━━━━━━━━\nSelect a topic below or type `/write <custom topic>`:';

    const text = (ctx.message as any)?.text || '';
    const customTopic = text.replace('/write', '').trim();

    if (customTopic) {
      activeWritingSessions.set(telegramId, { topic: customTopic, taskType: 'task2', waitingForEssay: true });
      const prompt = lang === 'vi'
        ? `📝 *ĐỀ BÀI:*\n_${customTopic}_\n\n✏️ Hãy viết bài luận (ít nhất 250 từ) và gửi cho tôi. Tôi sẽ chấm điểm theo 4 tiêu chí IELTS!`
        : `📝 *TOPIC:*\n_${customTopic}_\n\n✏️ Write your essay (at least 250 words) and send it to me. I will grade it using 4 IELTS criteria!`;
      await ctx.reply(prompt, { parse_mode: 'Markdown' });
      return;
    }

    const buttons = writingTopics.map((t, i) => {
      const label = lang === 'vi' ? t.vi.substring(0, 60) + '...' : t.en.substring(0, 60) + '...';
      return [Markup.button.callback(label, `write_topic_${t.id}`)];
    });
    buttons.push([Markup.button.callback(lang === 'vi' ? '🎲 Đề ngẫu nhiên' : '🎲 Random Topic', 'write_topic_random')]);

    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });

  // Topic selection handler
  bot.action(/^write_topic_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const topicId = match[1];

    await ctx.answerCbQuery();

    let selectedTopic: typeof writingTopics[0];
    if (topicId === 'random') {
      selectedTopic = writingTopics[Math.floor(Math.random() * writingTopics.length)];
    } else {
      selectedTopic = writingTopics.find(t => t.id === topicId) || writingTopics[0];
    }

    const topicText = lang === 'vi' ? selectedTopic.vi : selectedTopic.en;
    activeWritingSessions.set(telegramId, { topic: topicText, taskType: 'task2', waitingForEssay: true });

    const prompt = lang === 'vi'
      ? `📝 *ĐỀ BÀI WRITING TASK 2:*\n\n_${topicText}_\n\n━━━━━━━━━━━━━━━━━━━━━━\n✏️ Hãy viết bài luận của bạn (ít nhất 250 từ) và gửi cho tôi.\nTôi sẽ chấm điểm theo *4 tiêu chí IELTS*:\n• Task Achievement\n• Coherence & Cohesion\n• Lexical Resource\n• Grammatical Range & Accuracy\n\n⏱️ Mục tiêu: hoàn thành trong 40 phút!`
      : `📝 *WRITING TASK 2 TOPIC:*\n\n_${topicText}_\n\n━━━━━━━━━━━━━━━━━━━━━━\n✏️ Write your essay (minimum 250 words) and send it to me.\nI will grade it on *4 IELTS criteria*:\n• Task Achievement\n• Coherence & Cohesion\n• Lexical Resource\n• Grammatical Range & Accuracy\n\n⏱️ Target: finish in 40 minutes!`;

    await ctx.editMessageText(prompt, { parse_mode: 'Markdown' });
  });

  // Listen for essay submissions (text messages from users with active sessions)
  bot.on('text', async (ctx: Context, next: () => Promise<void>) => {
    const telegramId = ctx.from!.id.toString();
    const session = activeWritingSessions.get(telegramId);

    if (!session || !session.waitingForEssay) {
      return next();
    }

    const essay = (ctx.message as any)?.text || '';
    const wordCount = essay.split(/\s+/).filter((w: string) => w.length > 0).length;

    if (wordCount < 50) {
      return next(); // Too short, probably not an essay
    }

    const lang = getUserLang(telegramId);
    session.waitingForEssay = false;

    await ctx.reply(lang === 'vi' ? `⏳ Đang chấm bài (${wordCount} từ)... Vui lòng đợi 10-20 giây.` : `⏳ Grading your essay (${wordCount} words)... Please wait 10-20 seconds.`);

    const gradePrompt = `You are an experienced IELTS examiner. Grade the following IELTS Writing Task 2 essay.

Topic: "${session.topic}"

Essay:
"""
${essay}
"""

Word count: ${wordCount}

Grade this essay and return your response STRICTLY as JSON:
{
  "band_score": <overall band score, e.g. 6.5>,
  "ta_score": <Task Achievement score>,
  "cc_score": <Coherence and Cohesion score>,
  "lr_score": <Lexical Resource score>,
  "gra_score": <Grammatical Range and Accuracy score>,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "improved_sentence_1": {"original": "...", "improved": "..."},
  "improved_sentence_2": {"original": "...", "improved": "..."},
  "suggestions": ["suggestion 1", "suggestion 2"],
  "model_paragraph": "A short model paragraph showing how to improve the introduction or a weak paragraph"
}
Only return valid JSON, nothing else.`;

    try {
      const response = await askAi(gradePrompt, 'You are a strict but fair IELTS Writing examiner with 15 years of experience. Always provide JSON output.');
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const data = JSON.parse(jsonMatch[0]);

      // Save to database
      const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
      if (user) {
        db.prepare(`INSERT INTO writing_submissions (user_id, task_type, topic, essay, band_score, feedback, ta_score, cc_score, lr_score, gra_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(user.id, session.taskType, session.topic, essay, data.band_score, JSON.stringify(data), data.ta_score, data.cc_score, data.lr_score, data.gra_score);
      }

      const resultMsg = lang === 'vi'
        ? `📊 *KẾT QUẢ CHẤM BÀI WRITING*
━━━━━━━━━━━━━━━━━━━━━━

📝 Số từ: ${wordCount} ${wordCount < 250 ? '⚠️ (thiếu từ!)' : '✅'}

🎯 *BAND SCORE: ${data.band_score}*

📋 *Chi tiết 4 tiêu chí:*
• Task Achievement: *${data.ta_score}*
• Coherence & Cohesion: *${data.cc_score}*
• Lexical Resource: *${data.lr_score}*
• Grammar Range & Accuracy: *${data.gra_score}*

✅ *Điểm mạnh:*
${(data.strengths || []).map((s: string) => `• ${s}`).join('\n')}

❌ *Điểm yếu:*
${(data.weaknesses || []).map((w: string) => `• ${w}`).join('\n')}

✏️ *Câu cần sửa:*
${data.improved_sentence_1 ? `❌ _${data.improved_sentence_1.original}_\n✅ _${data.improved_sentence_1.improved}_` : ''}
${data.improved_sentence_2 ? `\n❌ _${data.improved_sentence_2.original}_\n✅ _${data.improved_sentence_2.improved}_` : ''}

💡 *Gợi ý cải thiện:*
${(data.suggestions || []).map((s: string) => `• ${s}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━
📚 Dùng /write để luyện thêm!`
        : `📊 *WRITING GRADE REPORT*
━━━━━━━━━━━━━━━━━━━━━━

📝 Word count: ${wordCount} ${wordCount < 250 ? '⚠️ (under limit!)' : '✅'}

🎯 *BAND SCORE: ${data.band_score}*

📋 *Criteria Breakdown:*
• Task Achievement: *${data.ta_score}*
• Coherence & Cohesion: *${data.cc_score}*
• Lexical Resource: *${data.lr_score}*
• Grammar Range & Accuracy: *${data.gra_score}*

✅ *Strengths:*
${(data.strengths || []).map((s: string) => `• ${s}`).join('\n')}

❌ *Weaknesses:*
${(data.weaknesses || []).map((w: string) => `• ${w}`).join('\n')}

✏️ *Sentence Corrections:*
${data.improved_sentence_1 ? `❌ _${data.improved_sentence_1.original}_\n✅ _${data.improved_sentence_1.improved}_` : ''}
${data.improved_sentence_2 ? `\n❌ _${data.improved_sentence_2.original}_\n✅ _${data.improved_sentence_2.improved}_` : ''}

💡 *Suggestions:*
${(data.suggestions || []).map((s: string) => `• ${s}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━
📚 Use /write for more practice!`;

      await ctx.reply(resultMsg, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('Writing grade error:', e);
      await ctx.reply(lang === 'vi' ? '❌ Lỗi khi chấm bài. Vui lòng thử lại.' : '❌ Error grading essay. Please try again.');
    } finally {
      activeWritingSessions.delete(telegramId);
    }
  });
}
