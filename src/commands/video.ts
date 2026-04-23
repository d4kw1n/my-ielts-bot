import { Context, Markup } from 'telegraf';
import { askAi } from '../services/ai_service';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

const predefinedTopics = [
  { id: 'education', name: '🎓 Education', vi: 'Giáo dục' },
  { id: 'technology', name: '💻 Technology', vi: 'Công nghệ' },
  { id: 'environment', name: '🌍 Environment', vi: 'Môi trường' },
  { id: 'health', name: '🏥 Health & Fitness', vi: 'Sức khỏe' },
  { id: 'society', name: '👥 Society & Culture', vi: 'Xã hội' },
];

export function registerVideoCommand(bot: any): void {
  bot.command('video', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    
    // Check if user provided a custom topic in command
    const text = (ctx.message as any)?.text || '';
    const customTopic = text.split(/\s+/).slice(1).join(' ');

    if (customTopic) {
      await recommendVideo(ctx, telegramId, customTopic, lang);
      return;
    }

    // Otherwise show topic selection
    const title = lang === 'vi' 
      ? '📺 GỢI Ý VIDEO LUYỆN NGHE' 
      : '📺 LISTENING VIDEO RECOMMENDATIONS';
    
    const subtitle = lang === 'vi'
      ? 'Chọn một chủ đề phổ biến trong IELTS hoặc gửi `/video <chủ đề>` để tìm kiếm tùy chỉnh:'
      : 'Select a common IELTS topic or send `/video <topic>` for custom search:';

    const buttons = [];
    for (let i = 0; i < predefinedTopics.length; i += 2) {
      const row = [Markup.button.callback(
        lang === 'vi' ? predefinedTopics[i].vi : predefinedTopics[i].name, 
        `video_${predefinedTopics[i].id}`
      )];
      if (predefinedTopics[i+1]) {
        row.push(Markup.button.callback(
          lang === 'vi' ? predefinedTopics[i+1].vi : predefinedTopics[i+1].name, 
          `video_${predefinedTopics[i+1].id}`
        ));
      }
      buttons.push(row);
    }
    
    buttons.push([Markup.button.callback(lang === 'vi' ? '🎲 Bất kỳ (Ngẫu nhiên)' : '🎲 Random', 'video_random')]);

    await ctx.reply(`${title}\n━━━━━━━━━━━━━━━━━━━━━━\n${subtitle}`, Markup.inlineKeyboard(buttons));
  });

  bot.action(/^video_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const topicId = match[1];
    
    await ctx.answerCbQuery();
    
    let topic = topicId;
    if (topicId === 'random') {
      topic = 'any random interesting IELTS topic like science, psychology, or history';
    } else {
      const found = predefinedTopics.find(t => t.id === topicId);
      topic = found ? found.name : topicId;
    }

    await recommendVideo(ctx, telegramId, topic, lang, true);
  });
}

async function recommendVideo(ctx: Context, telegramId: string, topic: string, lang: Lang, isCallback = false): Promise<void> {
  let waitMsg;
  if (isCallback) {
    waitMsg = await ctx.editMessageText(lang === 'vi' ? '🔍 Đang tìm video phù hợp...' : '🔍 Finding a suitable video...');
  } else {
    waitMsg = await ctx.reply(lang === 'vi' ? '🔍 Đang tìm video phù hợp...' : '🔍 Finding a suitable video...');
  }

  const prompt = lang === 'vi'
    ? `Tôi đang ôn thi IELTS Listening band 7.0. Hãy giới thiệu cho tôi 1 video trên YouTube (chỉ 1 video) về chủ đề "${topic}".
Yêu cầu trả lời theo format sau:
📺 *Tên Video:* (Tên thật của video)
🗣️ *Kênh YouTube:* (Tên kênh, ví dụ: TED-Ed, BBC Learning English, Kurzgesagt...)
🔗 *Link Search YouTube:* (Tạo 1 link search: https://www.youtube.com/results?search_query=tên+video+và+kênh)
📝 *Tại sao nên xem:* (Giải thích ngắn gọn lợi ích cho phần thi Listening, cấu trúc ngữ pháp hay từ vựng nổi bật)

Ghi chú: Trả lời hoàn toàn bằng tiếng Việt.`
    : `I am preparing for IELTS Listening band 7.0. Recommend exactly 1 YouTube video about the topic "${topic}".
Please reply in the following format:
📺 *Video Title:* (Real title of the video)
🗣️ *YouTube Channel:* (e.g., TED-Ed, BBC Learning English, Kurzgesagt...)
🔗 *YouTube Search Link:* (Generate a search link: https://www.youtube.com/results?search_query=video+title+channel)
📝 *Why watch this:* (Briefly explain the benefit for IELTS Listening, interesting grammar, or vocabulary)

Note: Reply entirely in English.`;

  const systemPrompt = "You are a helpful IELTS teacher. Recommend real, existing popular YouTube videos suitable for advanced English learners.";

  const rawRecommendation = await askAi(prompt, systemPrompt);
  const recommendation = rawRecommendation.replace(/\*\*/g, '*');

  const replyMsg = `${lang === 'vi' ? '🎯 *GỢI Ý VIDEO LUYỆN NGHE*' : '🎯 *VIDEO RECOMMENDATION*'}\n━━━━━━━━━━━━━━━━━━━━━━\n${recommendation}\n━━━━━━━━━━━━━━━━━━━━━━\n💡 ${lang === 'vi' ? 'Sau khi xem xong, dùng `/log listening` để ghi nhận thời gian nhé!' : 'After watching, use `/log listening` to log your study time!'}`;

  try {
    if (isCallback) {
      await ctx.editMessageText(replyMsg, { parse_mode: 'Markdown' });
    } else {
      await ctx.telegram.editMessageText(ctx.chat!.id, (waitMsg as any).message_id, undefined, replyMsg, { parse_mode: 'Markdown' });
    }
  } catch (e) {
    // Fallback without markdown if parsing fails
    if (isCallback) {
      await ctx.editMessageText(replyMsg);
    } else {
      await ctx.telegram.editMessageText(ctx.chat!.id, (waitMsg as any).message_id, undefined, replyMsg);
    }
  }
}
