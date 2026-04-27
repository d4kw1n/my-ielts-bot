import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { getVietnamNow } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerScheduleCommand(bot: any): void {
  bot.command('schedule', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) { await ctx.reply('/start first'); return; }

    const suggestions: string[] = [];
    const now = getVietnamNow();
    for (let i = 1; i <= 28 && suggestions.length < 4; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        suggestions.push(`${y}-${m}-${day}`);
      }
    }

    const title = lang === 'vi' ? '🗓️ LÊN LỊCH KIỂM TRA' : '🗓️ SCHEDULE TEST';
    const subtitle = lang === 'vi'
      ? 'Chọn ngày kiểm tra (gợi ý cuối tuần):'
      : 'Select test date (weekends suggested):';

    // Check existing scheduled test
    const existing = db.prepare(
      `SELECT * FROM scheduled_tests WHERE user_id = ? AND status = 'scheduled' ORDER BY test_date LIMIT 1`
    ).get(user.id) as any;

    let msg = `${title}\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (existing) {
      msg += `\n📌 ${lang === 'vi' ? 'Test đã lên lịch' : 'Scheduled test'}: ${existing.test_date}\n`;
    }
    msg += `\n${subtitle}`;

    const buttons = suggestions.map(date => {
      const d = new Date(date);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      return [Markup.button.callback(`📅 ${date} (${dayName})`, `schedule_${date}`)];
    });

    buttons.push([Markup.button.callback(
      lang === 'vi' ? '📝 Nhập ngày khác' : '📝 Enter custom date',
      'schedule_custom'
    )]);

    await ctx.reply(msg, Markup.inlineKeyboard(buttons));
  });

  bot.action(/^schedule_(\d{4}-\d{2}-\d{2})$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const testDate = match[1];
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;

    db.prepare(`INSERT INTO scheduled_tests (user_id, test_date, test_type, status) VALUES (?, ?, 'monthly', 'scheduled')`)
      .run(user.id, testDate);

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      lang === 'vi'
        ? `✅ Đã lên lịch kiểm tra!\n\n📅 Ngày: ${testDate}\n📋 Loại: Monthly Mock Test\n\n⏰ Bot sẽ nhắc bạn trước 1 ngày!\n\n💡 Sau khi test xong, dùng /score để nhập điểm.`
        : `✅ Test scheduled!\n\n📅 Date: ${testDate}\n📋 Type: Monthly Mock Test\n\n⏰ Bot will remind you 1 day before!\n\n💡 After the test, use /score to enter results.`
    );
  });

  bot.action('schedule_custom', async (ctx: Context) => {
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      lang === 'vi'
        ? '📝 Gửi ngày theo format: /schedule_date YYYY-MM-DD\nVí dụ: /schedule_date 2026-05-15'
        : '📝 Send date in format: /schedule_date YYYY-MM-DD\nExample: /schedule_date 2026-05-15'
    );
  });

  bot.command('schedule_date', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const text = (ctx.message as any)?.text || '';
    const dateStr = text.split(/\s+/)[1];

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      await ctx.reply(lang === 'vi' ? '❌ Format: YYYY-MM-DD' : '❌ Format: YYYY-MM-DD');
      return;
    }

    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
    db.prepare(`INSERT INTO scheduled_tests (user_id, test_date, test_type, status) VALUES (?, ?, 'monthly', 'scheduled')`)
      .run(user.id, dateStr);

    await ctx.reply(
      lang === 'vi'
        ? `✅ Đã lên lịch kiểm tra ngày ${dateStr}!`
        : `✅ Test scheduled for ${dateStr}!`
    );
  });

  // Next test command
  bot.command('next_test', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) return;

    const next = db.prepare(
      `SELECT * FROM scheduled_tests WHERE user_id = ? AND status = 'scheduled' AND test_date >= date('now') ORDER BY test_date LIMIT 1`
    ).get(user.id) as any;

    if (!next) {
      await ctx.reply(lang === 'vi'
        ? '📅 Chưa có bài test nào được lên lịch. Dùng /schedule để lên lịch.'
        : '📅 No upcoming tests. Use /schedule to schedule one.'
      );
      return;
    }

    const daysLeft = Math.ceil((new Date(next.test_date).getTime() - Date.now()) / (86400000));
    await ctx.reply(
      lang === 'vi'
        ? `📅 BÀI KIỂM TRA TIẾP THEO\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Ngày: ${next.test_date}\n📋 Loại: ${next.test_type}\n⏰ Còn ${daysLeft} ngày\n\n💪 Chuẩn bị thật tốt nhé!`
        : `📅 NEXT TEST\n━━━━━━━━━━━━━━━━━━━━━━\n📅 Date: ${next.test_date}\n📋 Type: ${next.test_type}\n⏰ ${daysLeft} days left\n\n💪 Prepare well!`
    );
  });
}
