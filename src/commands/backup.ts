import { Context } from 'telegraf';
import db from '../database/db';
import { getNotionClient } from '../services/notion';
import { config } from '../config';

export function registerBackupCommand(bot: any): void {
  bot.command('backup', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const lang = user?.language || 'vi';

    const notion = getNotionClient();
    if (!notion || !config.notionDatabaseId) {
      return ctx.reply(
        lang === 'vi' 
          ? '❌ Vui lòng cấu hình NOTION_API_TOKEN và NOTION_DATABASE_ID trong file .env để dùng tính năng Backup.'
          : '❌ Please configure Notion in .env to use the Backup feature.'
      );
    }

    const msg = await ctx.reply(lang === 'vi' ? '⏳ Đang tiến hành trích xuất dữ liệu...' : '⏳ Extracting data...');

    try {
      // 1. Fetch data
      const users = db.prepare('SELECT * FROM users').all();
      const logs = db.prepare('SELECT * FROM study_logs').all();
      const questions = db.prepare('SELECT * FROM question_bank').all();

      const backupData = {
        timestamp: new Date().toISOString(),
        stats: {
          users: users.length,
          study_logs: logs.length,
          questions: questions.length
        },
        users,
        study_logs: logs,
        question_bank: questions
      };

      const jsonString = JSON.stringify(backupData, null, 2);

      // 2. Split into chunks of 1900 chars (Notion limit is 2000 per block)
      const chunks = [];
      for (let i = 0; i < jsonString.length; i += 1900) {
        chunks.push(jsonString.substring(i, i + 1900));
      }

      await ctx.telegram.editMessageText(ctx.chat!.id, msg.message_id, undefined, lang === 'vi' ? '☁️ Đang upload lên Notion...' : '☁️ Uploading to Notion...');

      // 3. Auto-detect the title property name of the Notion database
      let titleProp = 'title'; // safe fallback — Notion API accepts lowercase 'title' as generic
      try {
        const dbInfo = await notion.databases.retrieve({ database_id: config.notionDatabaseId });
        const props = (dbInfo as any).properties || {};
        for (const [key, val] of Object.entries(props)) {
          if ((val as any).type === 'title') { 
            titleProp = key;
            console.log(`[Backup] Detected Notion title property: "${key}"`);
            break; 
          }
        }
      } catch (detectErr: any) {
        console.error(`[Backup] Failed to detect title property: ${detectErr.message}`);
      }

      // 4. Create a new page in Notion
      const page = await notion.pages.create({
        parent: { database_id: config.notionDatabaseId },
        properties: {
          [titleProp]: {
            title: [
              { text: { content: `📦 System Backup - ${new Date().toISOString().split('T')[0]}` } }
            ]
          }
        }
      });

      // 4. Append chunks to the page (in batches to avoid rate limit or payload size issues)
      // Notion limits block children array to 100 blocks per request.
      for (let i = 0; i < chunks.length; i += 100) {
        const batchChunks = chunks.slice(i, i + 100);
        const children = batchChunks.map(chunk => ({
          object: 'block',
          type: 'code',
          code: {
            language: 'json',
            rich_text: [{ type: 'text', text: { content: chunk } }]
          }
        }));

        await notion.blocks.children.append({
          block_id: page.id,
          children: children as any
        });
      }

      // 5. Done
      const pageUrl = (page as any).url || 'https://notion.so';
      
      await ctx.telegram.editMessageText(
        ctx.chat!.id, 
        msg.message_id, 
        undefined, 
        lang === 'vi' 
          ? `✅ **Backup Thành Công!**\n\nToàn bộ dữ liệu (Người dùng, Tiến độ, Kho câu hỏi) đã được đóng gói và lưu an toàn vào Notion.\n🔗 Bạn có thể xem tại: ${pageUrl}`
          : `✅ **Backup Successful!**\n\nAll data has been safely backed up to Notion.\n🔗 View here: ${pageUrl}`,
        { parse_mode: 'Markdown' }
      );

    } catch (error: any) {
      console.error('Backup error:', error);
      await ctx.telegram.editMessageText(
        ctx.chat!.id, 
        msg.message_id, 
        undefined, 
        lang === 'vi' ? '❌ Quá trình backup thất bại. Vui lòng kiểm tra lại log.' : '❌ Backup failed. Check logs.'
      );
    }
  });
}
