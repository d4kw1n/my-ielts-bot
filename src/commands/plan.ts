import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { t, Lang } from '../utils/i18n';
import { getPhaseInfo } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

function getUserPhase(telegramId: string): number {
  const user = db.prepare('SELECT current_phase FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.current_phase || 1;
}

export function registerPlanCommand(bot: any): void {
  bot.command('plan', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const currentPhase = getUserPhase(telegramId);

    const user = db.prepare('SELECT target_score, target_date, estimated_band FROM users WHERE telegram_id = ?').get(telegramId) as any;

    const phaseInfo = getPhaseInfo(currentPhase);

    let header = lang === 'vi'
      ? `📋 KẾ HOẠCH HỌC IELTS ${user?.target_score || 7.0}
━━━━━━━━━━━━━━━━━━━━━━
🎯 Mục tiêu: Band ${user?.target_score || 7.0}
📅 Deadline: ${user?.target_date || 'Chưa đặt (dùng /settings)'}
🏷️ Trình độ ước tính: ${user?.estimated_band ? `Band ${user.estimated_band}` : 'Chưa xác định (dùng /placement)'}
📍 Phase hiện tại: ${phaseInfo.nameVi}
⏰ Thời gian học: 1-2 giờ/ngày`
      : `📋 IELTS ${user?.target_score || 7.0} STUDY PLAN
━━━━━━━━━━━━━━━━━━━━━━
🎯 Target: Band ${user?.target_score || 7.0}
📅 Deadline: ${user?.target_date || 'Not set (use /settings)'}
🏷️ Estimated level: ${user?.estimated_band ? `Band ${user.estimated_band}` : 'Unknown (use /placement)'}
📍 Current Phase: ${phaseInfo.name}
⏰ Study time: 1-2 hours/day`;

    const plan = `${header}

━━━━━━━━━━━━━━━━━━━━━━

${t('plan_phase1_title', lang)}
${currentPhase === 1 ? '👉 ' : ''}${t('plan_phase1', lang)}

${t('plan_phase2_title', lang)}
${currentPhase === 2 ? '👉 ' : ''}${t('plan_phase2', lang)}

${t('plan_phase3_title', lang)}
${currentPhase === 3 ? '👉 ' : ''}${t('plan_phase3', lang)}

━━━━━━━━━━━━━━━━━━━━━━
${lang === 'vi' ? '💡 Dùng các nút bên dưới để điều chỉnh phase:' : '💡 Use buttons below to switch phase:'}`;

    await ctx.reply(plan, Markup.inlineKeyboard([
      [
        Markup.button.callback('🌱 Phase 1', 'set_phase_1'),
        Markup.button.callback('🔥 Phase 2', 'set_phase_2'),
        Markup.button.callback('🎯 Phase 3', 'set_phase_3'),
      ],
      [
        Markup.button.callback(lang === 'vi' ? '📚 Xem tài liệu' : '📚 Resources', 'show_resources'),
        Markup.button.callback(lang === 'vi' ? '📊 Tiến trình' : '📊 Progress', 'show_progress'),
      ],
    ]));
  });

  // Phase switching
  for (const phase of [1, 2, 3]) {
    bot.action(`set_phase_${phase}`, async (ctx: Context) => {
      const telegramId = ctx.from!.id.toString();
      const lang = getUserLang(telegramId);
      db.prepare("UPDATE users SET current_phase = ?, updated_at = datetime('now') WHERE telegram_id = ?").run(phase, telegramId);
      const phaseInfo = getPhaseInfo(phase);
      const msg = lang === 'vi'
        ? `✅ Đã chuyển sang ${phaseInfo.nameVi}\n\n${phaseInfo.descriptionVi}`
        : `✅ Switched to ${phaseInfo.name}\n\n${phaseInfo.description}`;
      await ctx.answerCbQuery();
      await ctx.editMessageText(msg);
    });
  }
}
