import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

export function registerSettingsCommand(bot: any): void {
  bot.command('settings', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) { await ctx.reply('/start first'); return; }

    const wakeTime = user.wake_time || '07:00';
    const sleepTime = user.sleep_time || '23:00';
    const vocabCount = user.daily_vocab_count || 5;

    const msg = lang === 'vi'
      ? `⚙️ CÀI ĐẶT
━━━━━━━━━━━━━━━━━━━━━━
🎯 Mục tiêu: Band ${user.target_score}
📅 Deadline: ${user.target_date || 'Chưa đặt'}
🌐 Ngôn ngữ: ${user.language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
🔔 Nhắc nhở: ${user.reminder_enabled ? 'Bật' : 'Tắt'}
━━━━━━━━━━━━━━━━━━━━━━
📚 Số từ vựng/ngày: ${vocabCount}
🌅 Giờ thức: ${wakeTime}
🌙 Giờ ngủ: ${sleepTime}
⏰ Bot sẽ tự chia ${vocabCount + 2} bài học đều trong ngày`
      : `⚙️ SETTINGS
━━━━━━━━━━━━━━━━━━━━━━
🎯 Target: Band ${user.target_score}
📅 Deadline: ${user.target_date || 'Not set'}
🌐 Language: ${user.language === 'vi' ? '🇻🇳 Vietnamese' : '🇬🇧 English'}
🔔 Reminder: ${user.reminder_enabled ? 'On' : 'Off'}
━━━━━━━━━━━━━━━━━━━━━━
📚 Vocab/day: ${vocabCount}
🌅 Wake time: ${wakeTime}
🌙 Sleep time: ${sleepTime}
⏰ Bot will spread ${vocabCount + 2} lessons throughout your day`;

    await ctx.reply(msg, Markup.inlineKeyboard([
      [
        Markup.button.callback('🎯 Target', 'set_target'),
        Markup.button.callback('📅 Deadline', 'set_deadline'),
      ],
      [
        Markup.button.callback(`📚 Vocab: ${vocabCount}/day`, 'set_vocab_count'),
      ],
      [
        Markup.button.callback(`🌅 Wake: ${wakeTime}`, 'set_wake_time'),
        Markup.button.callback(`🌙 Sleep: ${sleepTime}`, 'set_sleep_time'),
      ],
      [
        Markup.button.callback(user.reminder_enabled ? '🔕 Tắt nhắc nhở' : '🔔 Bật nhắc nhở', 'toggle_reminder'),
        Markup.button.callback('🌐 Language', 'set_language'),
      ],
    ]));
  });

  bot.action('set_target', async (ctx: Context) => {
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      lang === 'vi' ? 'Chọn mục tiêu band score:' : 'Select target band:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('6.5', 'target_6.5'),
          Markup.button.callback('7.0', 'target_7.0'),
          Markup.button.callback('7.5', 'target_7.5'),
          Markup.button.callback('8.0', 'target_8.0'),
        ],
      ])
    );
  });

  bot.action(/^target_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const target = parseFloat(match[1]);
    const lang = getUserLang(telegramId);
    db.prepare("UPDATE users SET target_score = ?, updated_at = datetime('now') WHERE telegram_id = ?").run(target, telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(lang === 'vi' ? `✅ Mục tiêu: Band ${target}` : `✅ Target: Band ${target}`);
  });

  bot.action('set_deadline', async (ctx: Context) => {
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    const now = new Date();
    const options = [3, 6, 9, 12].map(m => {
      const d = new Date(now);
      d.setMonth(d.getMonth() + m);
      return { label: `${m} ${lang === 'vi' ? 'tháng' : 'months'}`, date: d.toISOString().split('T')[0] };
    });
    await ctx.editMessageText(
      lang === 'vi' ? 'Chọn deadline:' : 'Select deadline:',
      Markup.inlineKeyboard(options.map(o => [Markup.button.callback(o.label, `deadline_${o.date}`)]))
    );
  });

  bot.action(/^deadline_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const date = match[1];
    const lang = getUserLang(telegramId);
    db.prepare("UPDATE users SET target_date = ?, updated_at = datetime('now') WHERE telegram_id = ?").run(date, telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(lang === 'vi' ? `✅ Deadline: ${date}` : `✅ Deadline: ${date}`);
  });

  bot.action('toggle_reminder', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT reminder_enabled FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const newState = user.reminder_enabled ? 0 : 1;
    db.prepare('UPDATE users SET reminder_enabled = ? WHERE telegram_id = ?').run(newState, telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(lang === 'vi' ? `🔔 Nhắc nhở: ${newState ? 'Bật' : 'Tắt'}` : `🔔 Reminder: ${newState ? 'On' : 'Off'}`);
  });

  // Vocab count setting
  bot.action('set_vocab_count', async (ctx: Context) => {
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      lang === 'vi' ? '📚 Chọn số từ vựng muốn học mỗi ngày:' : '📚 Select daily vocab count:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('3 từ', 'vcount_3'),
          Markup.button.callback('5 từ', 'vcount_5'),
          Markup.button.callback('8 từ', 'vcount_8'),
        ],
        [
          Markup.button.callback('10 từ', 'vcount_10'),
          Markup.button.callback('15 từ', 'vcount_15'),
          Markup.button.callback('20 từ', 'vcount_20'),
        ],
      ])
    );
  });

  bot.action(/^vcount_(\d+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const count = parseInt(match[1], 10);
    const lang = getUserLang(telegramId);
    db.prepare('UPDATE users SET daily_vocab_count = ? WHERE telegram_id = ?').run(count, telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(lang === 'vi' ? `✅ Sẽ học ${count} từ vựng/ngày` : `✅ Will learn ${count} vocab/day`);
  });

  // Wake time setting
  bot.action('set_wake_time', async (ctx: Context) => {
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      lang === 'vi' ? '🌅 Bạn thường thức dậy lúc mấy giờ?' : '🌅 When do you usually wake up?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('05:00', 'wake_05:00'),
          Markup.button.callback('06:00', 'wake_06:00'),
          Markup.button.callback('06:30', 'wake_06:30'),
        ],
        [
          Markup.button.callback('07:00', 'wake_07:00'),
          Markup.button.callback('07:30', 'wake_07:30'),
          Markup.button.callback('08:00', 'wake_08:00'),
        ],
        [
          Markup.button.callback('08:30', 'wake_08:30'),
          Markup.button.callback('09:00', 'wake_09:00'),
          Markup.button.callback('10:00', 'wake_10:00'),
        ],
      ])
    );
  });

  bot.action(/^wake_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const time = match[1];
    const lang = getUserLang(telegramId);
    db.prepare('UPDATE users SET wake_time = ? WHERE telegram_id = ?').run(time, telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(lang === 'vi' ? `✅ Giờ thức dậy: ${time}` : `✅ Wake time: ${time}`);
  });

  // Sleep time setting
  bot.action('set_sleep_time', async (ctx: Context) => {
    const lang = getUserLang(ctx.from!.id.toString());
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      lang === 'vi' ? '🌙 Bạn thường đi ngủ lúc mấy giờ?' : '🌙 When do you usually go to sleep?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('21:00', 'sleep_21:00'),
          Markup.button.callback('22:00', 'sleep_22:00'),
          Markup.button.callback('22:30', 'sleep_22:30'),
        ],
        [
          Markup.button.callback('23:00', 'sleep_23:00'),
          Markup.button.callback('23:30', 'sleep_23:30'),
          Markup.button.callback('00:00', 'sleep_00:00'),
        ],
        [
          Markup.button.callback('00:30', 'sleep_00:30'),
          Markup.button.callback('01:00', 'sleep_01:00'),
          Markup.button.callback('02:00', 'sleep_02:00'),
        ],
      ])
    );
  });

  bot.action(/^sleep_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const match = (ctx as any).match;
    const time = match[1];
    const lang = getUserLang(telegramId);
    db.prepare('UPDATE users SET sleep_time = ? WHERE telegram_id = ?').run(time, telegramId);
    await ctx.answerCbQuery();
    await ctx.editMessageText(lang === 'vi' ? `✅ Giờ đi ngủ: ${time}` : `✅ Sleep time: ${time}`);
  });

  bot.action('set_language', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('🌐 Select / Chọn:', Markup.inlineKeyboard([
      [Markup.button.callback('🇻🇳 Tiếng Việt', 'set_lang_vi'), Markup.button.callback('🇬🇧 English', 'set_lang_en')],
    ]));
  });

  // Tips command
  bot.command('tips', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT current_phase FROM users WHERE telegram_id = ?').get(telegramId) as any;
    const phase = user?.current_phase || 1;

    const tips: Record<number, { vi: string; en: string }> = {
      1: {
        vi: `💡 TIPS PHASE 1 - NỀN TẢNG
━━━━━━━━━━━━━━━━━━━━━━
🎧 Listening:
• Nghe BBC 6 Minute English mỗi ngày
• Bật subtitle tiếng Anh khi xem phim
• Tập nghe dictation (viết lại những gì nghe được)

📖 Reading:
• Đọc 1 bài báo tiếng Anh/ngày (The Guardian, BBC)
• Highlight từ mới và tra nghĩa
• Tập skimming: đọc lướt tìm ý chính

✍️ Writing:
• Viết nhật ký bằng tiếng Anh mỗi ngày
• Học 10 linking words cơ bản
• Đọc bài mẫu band 7+ trên IELTS Liz

🗣️ Speaking:
• Nói chuyện với bản thân bằng tiếng Anh
• Record giọng nói và nghe lại
• Luyện phát âm với ELSA Speak

📚 Vocabulary:
• Dùng Anki flashcard - 15 từ/ngày
• Học theo topic: Environment, Education, Technology
• Viết câu ví dụ cho mỗi từ mới`,
        en: `💡 PHASE 1 TIPS - FOUNDATION
━━━━━━━━━━━━━━━━━━━━━━
🎧 Listening:
• Listen to BBC 6 Minute English daily
• Use English subtitles when watching movies
• Practice dictation

📖 Reading:
• Read 1 English article/day
• Highlight new words
• Practice skimming for main ideas

✍️ Writing:
• Write an English diary daily
• Learn 10 basic linking words
• Read band 7+ samples on IELTS Liz

🗣️ Speaking:
• Talk to yourself in English
• Record and review your speech
• Use ELSA Speak for pronunciation

📚 Vocabulary:
• Use Anki flashcards - 15 words/day
• Learn by topic: Environment, Education, Tech
• Write example sentences for new words`,
      },
      2: {
        vi: `💡 TIPS PHASE 2 - CHUYÊN SÂU
━━━━━━━━━━━━━━━━━━━━━━
🎧 Listening: Luyện Cambridge, tập note-taking
📖 Reading: Bấm giờ 20 phút/passage, học paraphrase
✍️ Writing: 2-3 essays/tuần, dùng Write & Improve
🗣️ Speaking: Mock test hàng tuần, luyện Part 2 cue card
📝 Grammar: Học conditional, passive, relative clauses`,
        en: `💡 PHASE 2 TIPS - INTENSIVE
━━━━━━━━━━━━━━━━━━━━━━
🎧 Listening: Cambridge practice, note-taking skills
📖 Reading: Timed 20 min/passage, learn paraphrasing
✍️ Writing: 2-3 essays/week, use Write & Improve
🗣️ Speaking: Weekly mock tests, practice Part 2 cue cards
📝 Grammar: Conditionals, passive, relative clauses`,
      },
      3: {
        vi: `💡 TIPS PHASE 3 - THI THỬ
━━━━━━━━━━━━━━━━━━━━━━
📝 Full test 2 lần/tuần, phân tích lỗi sau mỗi test
✍️ Chuẩn bị template cho Writing Task 1 & 2
🗣️ Luyện nói 15 phút/ngày trước gương
⏱️ Quản lý thời gian: 20 phút/passage Reading
🧘 Giữ tinh thần thoải mái, ngủ đủ giấc`,
        en: `💡 PHASE 3 TIPS - MOCK TESTS
━━━━━━━━━━━━━━━━━━━━━━
📝 Full tests 2x/week, analyze mistakes after each
✍️ Prepare templates for Writing Task 1 & 2
🗣️ 15 min/day speaking practice in front of mirror
⏱️ Time management: 20 min/reading passage
🧘 Stay relaxed, get enough sleep`,
      },
    };

    const tipText = tips[phase];
    await ctx.reply(lang === 'vi' ? tipText.vi : tipText.en);
  });

  // Remind command
  bot.command('remind', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const text = (ctx.message as any)?.text || '';
    const time = text.split(/\s+/)[1];

    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      await ctx.reply(lang === 'vi' ? '⏰ Dùng: /remind HH:MM\nVí dụ: /remind 20:00' : '⏰ Usage: /remind HH:MM\nExample: /remind 20:00');
      return;
    }

    db.prepare('UPDATE users SET daily_reminder_time = ?, reminder_enabled = 1 WHERE telegram_id = ?').run(time, telegramId);
    await ctx.reply(lang === 'vi' ? `✅ Nhắc nhở hàng ngày lúc ${time}` : `✅ Daily reminder set at ${time}`);
  });
}
