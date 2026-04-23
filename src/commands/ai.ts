import { Context } from 'telegraf';
import { askAi } from '../services/ai_service';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerAiCommand(bot: any): void {
  bot.command('ask', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const text = (ctx.message as any)?.text || '';
    const question = text.split(/\s+/).slice(1).join(' ');

    if (!question) {
      await ctx.reply(lang === 'vi' 
        ? '🤖 Gửi câu hỏi cho AI (ví dụ: `/ask Cách cải thiện Reading phần True/False/Not Given`)' 
        : '🤖 Ask the AI a question (e.g., `/ask How to improve True/False/Not Given in Reading`)');
      return;
    }

    const waitMsg = await ctx.reply(lang === 'vi' ? '🧠 Đang suy nghĩ...' : '🧠 Thinking...');

    const systemPrompt = lang === 'vi' 
      ? 'Bạn là IELTS Buddy, một trợ lý AI thông minh chuyên hỗ trợ học viên đạt mục tiêu IELTS 7.0+. Hãy trả lời ngắn gọn, súc tích, dễ hiểu, dùng tiếng Việt và thỉnh thoảng chèn tiếng Anh nếu cần thiết. Đưa ra các ví dụ cụ thể.'
      : 'You are IELTS Buddy, a smart AI assistant specializing in helping students achieve IELTS 7.0+. Answer concisely, clearly, and provide specific examples. Use English.';

    const answer = await askAi(question, systemPrompt);

    await ctx.telegram.editMessageText(ctx.chat!.id, (waitMsg as any).message_id, undefined, answer);
  });
}
