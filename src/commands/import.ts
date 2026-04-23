import { Context, Markup } from 'telegraf';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { askAi } from '../services/ai_service';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerImportCommand(bot: any): void {
  bot.command('import', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    
    const messageText = (ctx.message as any).text;
    const input = messageText.replace('/import', '').trim();

    if (!input) {
      await ctx.reply(
        lang === 'vi'
          ? `📥 **Công cụ bóc tách & tạo câu hỏi AI**\n\nBạn có thể đưa cho tôi:\n1. Một đường link trang web (BBC, CNN, hoặc trang web luyện thi IELTS bất kỳ).\n2. Hoặc dán trực tiếp đoạn văn bản tiếng Anh vào đây.\n\nTôi sẽ dùng AI để đọc và tự động tạo/bóc tách ra các câu hỏi trắc nghiệm IELTS rồi lưu vào kho!\n\n**Cách dùng:** \`/import <link_hoặc_văn_bản>\``
          : `📥 **AI Question Extractor & Generator**\n\nYou can give me:\n1. A website link (BBC, CNN, or any IELTS test site).\n2. Or paste an English text directly.\n\nI will use AI to read and generate/extract IELTS multiple choice questions and save them to the bank!\n\n**Usage:** \`/import <link_or_text>\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const waitMsg = await ctx.reply(lang === 'vi' ? '⏳ Đang xử lý dữ liệu, vui lòng chờ...' : '⏳ Processing data, please wait...');

    try {
      let rawText = input;

      // If it's a URL, fetch and extract text
      if (input.startsWith('http://') || input.startsWith('https://')) {
        await ctx.telegram.editMessageText(ctx.chat!.id, waitMsg.message_id, undefined, lang === 'vi' ? '🌐 Đang tải nội dung trang web...' : '🌐 Fetching website content...');
        const response = await axios.get(input);
        const $ = cheerio.load(response.data);
        
        // Remove scripts and styles
        $('script, style, nav, footer, header, aside').remove();
        
        // Extract plain text
        rawText = $('body').text().replace(/\s+/g, ' ').trim();
        
        // Limit text length to avoid token limits
        if (rawText.length > 8000) {
          rawText = rawText.substring(0, 8000);
        }
      }

      await ctx.telegram.editMessageText(ctx.chat!.id, waitMsg.message_id, undefined, lang === 'vi' ? '🧠 Đang yêu cầu AI phân tích và bóc tách câu hỏi...' : '🧠 Asking AI to analyze and extract questions...');

      const prompt = `You are an expert IELTS curriculum parser. 
I am providing you with a raw text extracted from a webpage or document. 
If the text already contains IELTS multiple-choice questions, extract them. 
If the text is just an article (like news or essay), generate 5 high-quality IELTS multiple-choice questions based on the text.

You MUST respond ONLY with a valid JSON array of objects. Do not wrap in markdown or add explanations.

Schema for each object:
{
  "type": "vocabulary" | "grammar" | "reading",
  "level": "B1" | "B2" | "C1" | "C2",
  "question": "The question in English (include a short passage from the text here if reading)",
  "question_vi": "The question translated to Vietnamese (include the English passage, followed by translated question)",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": 0 | 1 | 2 | 3 (the index of the correct option),
  "band": 5.0 to 8.5 (number)
}

Here is the raw text:
"""
${rawText}
"""`;

      const aiResponse = await askAi(prompt, 'You are an AI that outputs pure JSON arrays only.');
      
      if (aiResponse.startsWith('❌')) {
        await ctx.telegram.editMessageText(ctx.chat!.id, waitMsg.message_id, undefined, aiResponse);
        return;
      }

      const jsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const questions = JSON.parse(jsonStr);

      if (Array.isArray(questions) && questions.length > 0) {
        const insert = db.prepare(`
          INSERT INTO question_bank (type, level, question, question_vi, options, answer, band, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ai_import')
        `);

        let count = 0;
        const insertMany = db.transaction((items: any[]) => {
          for (const item of items) {
            if (!item.type || !item.question || !Array.isArray(item.options) || item.answer === undefined) continue;
            
            insert.run(
              item.type,
              item.level || 'B2',
              item.question,
              item.question_vi || '',
              JSON.stringify(item.options),
              item.answer.toString(),
              item.band || 6.0
            );
            count++;
          }
        });

        insertMany(questions);
        
        await ctx.telegram.editMessageText(
          ctx.chat!.id, 
          waitMsg.message_id, 
          undefined, 
          lang === 'vi' 
            ? `✅ **Thành công!**\nAI đã bóc tách và lưu thành công **${count}** câu hỏi vào Kho câu hỏi.\nBạn có thể thử nghiệm ngay bằng lệnh /placement.`
            : `✅ **Success!**\nAI successfully extracted and saved **${count}** questions to the bank.\nYou can test them now using /placement.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        throw new Error("No questions returned");
      }
    } catch (error) {
      console.error('Import error:', error);
      await ctx.telegram.editMessageText(
        ctx.chat!.id, 
        waitMsg.message_id, 
        undefined, 
        lang === 'vi' ? '❌ Có lỗi xảy ra khi bóc tách câu hỏi. Có thể định dạng bài viết quá phức tạp hoặc AI không nhận diện được.' : '❌ Error extracting questions. The text format might be too complex.'
      );
    }
  });
}
