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
      // Direct search
      await recommendVideo(ctx, telegramId, customTopic, lang, false);
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
        `vtopic_${predefinedTopics[i].id}`
      )];
      if (predefinedTopics[i+1]) {
        row.push(Markup.button.callback(
          lang === 'vi' ? predefinedTopics[i+1].vi : predefinedTopics[i+1].name, 
          `vtopic_${predefinedTopics[i+1].id}`
        ));
      }
      buttons.push(row);
    }
    
    buttons.push([Markup.button.callback(lang === 'vi' ? '🎲 Bất kỳ (Ngẫu nhiên)' : '🎲 Random', 'vtopic_random')]);

    await ctx.reply(`${title}\n━━━━━━━━━━━━━━━━━━━━━━\n${subtitle}`, Markup.inlineKeyboard(buttons));
  });

  bot.action(/^vtopic_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const topicId = match[1];
    
    await ctx.answerCbQuery();

    const title = lang === 'vi' ? '🎥 Bạn muốn xem gì?' : '🎥 What do you want to watch?';
    const buttons = [
      [
        Markup.button.callback(lang === 'vi' ? '🎬 1 Video' : '🎬 1 Video', `vsingl_${topicId}`),
        Markup.button.callback(lang === 'vi' ? '📑 Danh sách (3 Video)' : '📑 List (3 Videos)', `vlist_${topicId}`)
      ]
    ];

    await ctx.editMessageText(title, Markup.inlineKeyboard(buttons));
  });

  bot.action(/^(vsingl|vlist)_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const type = match[1];
    const topicId = match[2];
    
    await ctx.answerCbQuery();
    
    let topic = topicId;
    if (topicId === 'random') {
      topic = 'any random interesting IELTS topic like science, psychology, or history';
    } else {
      const found = predefinedTopics.find(t => t.id === topicId);
      topic = found ? found.name : topicId;
    }

    await recommendVideo(ctx, telegramId, topic, lang, type === 'vlist');
  });
}

async function recommendVideo(ctx: Context, telegramId: string, topic: string, lang: Lang, isList = false): Promise<void> {
  let waitMsg;
  try {
    waitMsg = await ctx.editMessageText(lang === 'vi' ? '🔍 Đang tìm video phù hợp...' : '🔍 Finding suitable videos...');
  } catch(e) {
    waitMsg = await ctx.reply(lang === 'vi' ? '🔍 Đang tìm video phù hợp...' : '🔍 Finding suitable videos...');
  }

  const count = isList ? 3 : 1;
  const prompt = `I am preparing for IELTS Listening band 7.0. Recommend ${count} YouTube video(s) about "${topic}".
You MUST output ONLY a valid JSON array of objects. Do not wrap in markdown or add explanations.
Schema for each object:
{
  "title": "Real title of the video",
  "channel": "YouTube Channel (e.g. TED-Ed)",
  "reason": "Why watch this (in ${lang === 'vi' ? 'Vietnamese' : 'English'})",
  "search_query": "URL encoded search query of title and channel, e.g. how+internet+works+crash+course"
}`;

  const systemPrompt = "You are an AI that outputs pure JSON arrays only.";

  try {
    const rawRecommendation = await askAi(prompt, systemPrompt);
    const jsonStr = rawRecommendation.replace(/```json/g, '').replace(/```/g, '').trim();
    const videos = JSON.parse(jsonStr);

    if (!Array.isArray(videos) || videos.length === 0) {
      throw new Error("Invalid format");
    }

    let text = `${lang === 'vi' ? '🎯 *GỢI Ý VIDEO LUYỆN NGHE*' : '🎯 *VIDEO RECOMMENDATION*'}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    const buttons: any[] = [];

    videos.forEach((vid: any, idx: number) => {
      text += `📺 *${vid.title}*\n🗣️ *Kênh:* ${vid.channel}\n📝 *Tại sao:* ${vid.reason}\n\n`;
      const ytUrl = \`https://www.youtube.com/results?search_query=\${vid.search_query}\`;
      buttons.push([Markup.button.url(lang === 'vi' ? \`▶️ Xem Video \${isList ? idx + 1 : ''}\` : \`▶️ Watch Video \${isList ? idx + 1 : ''}\`, ytUrl)]);
    });

    text += \`━━━━━━━━━━━━━━━━━━━━━━\n💡 \${lang === 'vi' ? 'Sau khi xem xong, dùng /log listening nhé!' : 'After watching, use /log listening!'}\`;

    await ctx.telegram.editMessageText(ctx.chat!.id, (waitMsg as any).message_id, undefined, text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error("Video recommendation error:", error);
    await ctx.telegram.editMessageText(
      ctx.chat!.id, 
      (waitMsg as any).message_id, 
      undefined, 
      lang === 'vi' ? '❌ Lỗi trích xuất video. Vui lòng thử lại.' : '❌ Error parsing video. Please try again.'
    );
  }
}
