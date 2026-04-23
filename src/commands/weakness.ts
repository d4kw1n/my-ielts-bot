import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';
import { getSkillEmoji } from '../utils/helpers';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

interface SkillAnalysis {
  skill: string;
  score: number | null;
  studyMinutes: number;
  trend: 'improving' | 'declining' | 'stable' | 'no_data';
  recommendation: string;
  recommendationVi: string;
}

export function registerWeaknessCommand(bot: any): void {
  bot.command('weakness', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as any;
    if (!user) {
      await ctx.reply(lang === 'vi' ? '❌ Dùng /start trước.' : '❌ Use /start first.');
      return;
    }

    // Get latest test scores
    const latestScore = db.prepare('SELECT * FROM test_scores WHERE user_id = ? ORDER BY test_date DESC LIMIT 1').get(user.id) as any;
    const prevScore = db.prepare('SELECT * FROM test_scores WHERE user_id = ? ORDER BY test_date DESC LIMIT 1 OFFSET 1').get(user.id) as any;

    // Get study time per skill (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const studyStats = db.prepare(
      'SELECT skill, SUM(duration_minutes) as total FROM study_logs WHERE user_id = ? AND log_date >= ? GROUP BY skill'
    ).all(user.id, thirtyDaysAgo.toISOString().split('T')[0]) as any[];

    const studyMap: Record<string, number> = {};
    for (const s of studyStats) {
      studyMap[s.skill] = s.total;
    }

    // Get writing stats
    const writingStats = db.prepare(
      'SELECT AVG(band_score) as avg_band, AVG(ta_score) as avg_ta, AVG(cc_score) as avg_cc, AVG(lr_score) as avg_lr, AVG(gra_score) as avg_gra, COUNT(*) as cnt FROM writing_submissions WHERE user_id = ?'
    ).get(user.id) as any;

    // Get vocabulary mastery stats
    const vocabStats = db.prepare(
      'SELECT COUNT(*) as total, SUM(CASE WHEN mastery_level >= 3 THEN 1 ELSE 0 END) as mastered FROM learned_items WHERE user_id = ?'
    ).get(user.id) as any;

    // Analyze each skill
    const skills: SkillAnalysis[] = [
      {
        skill: 'listening',
        score: latestScore?.listening || null,
        studyMinutes: studyMap['listening'] || 0,
        trend: getTrend(latestScore?.listening, prevScore?.listening),
        recommendation: 'Practice with BBC 6 Minute English, Cambridge Listening tests. Use /video for recommendations.',
        recommendationVi: 'Luyện nghe BBC 6 Minute English, đề Cambridge Listening. Dùng /video để xem gợi ý.',
      },
      {
        skill: 'reading',
        score: latestScore?.reading || null,
        studyMinutes: studyMap['reading'] || 0,
        trend: getTrend(latestScore?.reading, prevScore?.reading),
        recommendation: 'Use /read for AI-powered reading practice. Focus on T/F/NG and Matching Headings.',
        recommendationVi: 'Dùng /read để luyện đọc hiểu AI. Tập trung vào dạng T/F/NG và Matching Headings.',
      },
      {
        skill: 'writing',
        score: latestScore?.writing || null,
        studyMinutes: studyMap['writing'] || 0,
        trend: getTrend(latestScore?.writing, prevScore?.writing),
        recommendation: 'Use /write to practice essays with AI grading. Focus on Task Achievement and Coherence.',
        recommendationVi: 'Dùng /write để luyện essay có AI chấm. Tập trung vào Task Achievement và Coherence.',
      },
      {
        skill: 'speaking',
        score: latestScore?.speaking || null,
        studyMinutes: studyMap['speaking'] || 0,
        trend: getTrend(latestScore?.speaking, prevScore?.speaking),
        recommendation: 'Use /speak for Part 1/2/3 practice. Record yourself and compare with sample answers.',
        recommendationVi: 'Dùng /speak để luyện Part 1/2/3. Ghi âm bản thân và so sánh với sample answer.',
      },
    ];

    // Find weakest skill
    const scoredSkills = skills.filter(s => s.score !== null);
    const weakest = scoredSkills.length > 0
      ? scoredSkills.reduce((min, s) => (s.score! < min.score!) ? s : min)
      : null;

    // Find least-practiced skill
    const leastPracticed = skills.reduce((min, s) => s.studyMinutes < min.studyMinutes ? s : min);

    const target = user.target_score || 7.0;

    // Build the analysis message
    let msg = lang === 'vi'
      ? `🧠 *PHÂN TÍCH ĐIỂM YẾU CÁ NHÂN*\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 Mục tiêu: Band ${target}\n🏷️ Trình độ: ${user.estimated_band ? `Band ${user.estimated_band}` : 'Chưa xác định'}\n\n`
      : `🧠 *PERSONAL WEAKNESS ANALYSIS*\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 Target: Band ${target}\n🏷️ Level: ${user.estimated_band ? `Band ${user.estimated_band}` : 'Unknown'}\n\n`;

    // Skill breakdown
    msg += lang === 'vi' ? '📊 *PHÂN TÍCH TỪNG KỸ NĂNG:*\n\n' : '📊 *SKILL BREAKDOWN:*\n\n';

    for (const skill of skills) {
      const emoji = getSkillEmoji(skill.skill);
      const trendIcon = skill.trend === 'improving' ? '📈' : skill.trend === 'declining' ? '📉' : '➡️';
      const scoreText = skill.score !== null ? `${skill.score}` : (lang === 'vi' ? 'N/A' : 'N/A');
      const gap = skill.score !== null ? (target - skill.score).toFixed(1) : '?';
      
      msg += `${emoji} *${skill.skill.charAt(0).toUpperCase() + skill.skill.slice(1)}*\n`;
      msg += `   📊 ${lang === 'vi' ? 'Điểm' : 'Score'}: ${scoreText} ${trendIcon} | `;
      msg += `⏱️ ${skill.studyMinutes}m (30d) | `;
      msg += `🎯 Gap: ${gap}\n`;
    }

    // Weakest skill highlight
    msg += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
    
    if (weakest) {
      msg += lang === 'vi'
        ? `\n🔴 *KỸ NĂNG YẾU NHẤT:* ${getSkillEmoji(weakest.skill)} ${weakest.skill.toUpperCase()} (${weakest.score})\n💡 ${weakest.recommendationVi}\n`
        : `\n🔴 *WEAKEST SKILL:* ${getSkillEmoji(weakest.skill)} ${weakest.skill.toUpperCase()} (${weakest.score})\n💡 ${weakest.recommendation}\n`;
    }

    msg += lang === 'vi'
      ? `\n⚠️ *ÍT LUYỆN TẬP NHẤT:* ${getSkillEmoji(leastPracticed.skill)} ${leastPracticed.skill.toUpperCase()} (${leastPracticed.studyMinutes}m/30 ngày)\n`
      : `\n⚠️ *LEAST PRACTICED:* ${getSkillEmoji(leastPracticed.skill)} ${leastPracticed.skill.toUpperCase()} (${leastPracticed.studyMinutes}m/30 days)\n`;

    // Writing detail
    if (writingStats && writingStats.cnt > 0) {
      msg += lang === 'vi'
        ? `\n✍️ *WRITING CHI TIẾT (${writingStats.cnt} bài):*\n   • Task Achievement: ${writingStats.avg_ta?.toFixed(1) || 'N/A'}\n   • Coherence: ${writingStats.avg_cc?.toFixed(1) || 'N/A'}\n   • Lexical Resource: ${writingStats.avg_lr?.toFixed(1) || 'N/A'}\n   • Grammar: ${writingStats.avg_gra?.toFixed(1) || 'N/A'}\n`
        : `\n✍️ *WRITING DETAIL (${writingStats.cnt} essays):*\n   • Task Achievement: ${writingStats.avg_ta?.toFixed(1) || 'N/A'}\n   • Coherence: ${writingStats.avg_cc?.toFixed(1) || 'N/A'}\n   • Lexical Resource: ${writingStats.avg_lr?.toFixed(1) || 'N/A'}\n   • Grammar: ${writingStats.avg_gra?.toFixed(1) || 'N/A'}\n`;
    }

    // Vocab stats
    if (vocabStats) {
      msg += lang === 'vi'
        ? `\n📚 *TỪ VỰNG:* ${vocabStats.mastered || 0}/${vocabStats.total || 0} đã thuộc (mastery ≥ 3)\n`
        : `\n📚 *VOCABULARY:* ${vocabStats.mastered || 0}/${vocabStats.total || 0} mastered (mastery ≥ 3)\n`;
    }

    // Action plan
    msg += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
    msg += lang === 'vi'
      ? `\n📋 *KẾ HOẠCH HÀNH ĐỘNG:*\n`
      : `\n📋 *ACTION PLAN:*\n`;

    if (weakest) {
      msg += lang === 'vi'
        ? `1. 🔴 Tập trung ${weakest.skill}: ${weakest.recommendationVi}\n`
        : `1. 🔴 Focus on ${weakest.skill}: ${weakest.recommendation}\n`;
    }
    msg += lang === 'vi'
      ? `2. ⚠️ Tăng thời lượng ${leastPracticed.skill}: Đặt mục tiêu 30 phút/ngày\n`
      : `2. ⚠️ Increase ${leastPracticed.skill} time: Target 30 min/day\n`;
    msg += lang === 'vi'
      ? `3. 📚 Tiếp tục học từ vựng hàng ngày với /vocab\n`
      : `3. 📚 Continue daily vocab with /vocab\n`;
    msg += lang === 'vi'
      ? `4. 🧪 Làm lại /placement sau 2 tuần để đo tiến bộ\n`
      : `4. 🧪 Retake /placement in 2 weeks to measure progress\n`;

    if (!latestScore) {
      msg += lang === 'vi'
        ? `\n⚠️ *Bạn chưa nhập điểm thi thử.* Dùng /score L R W S để phân tích chính xác hơn!`
        : `\n⚠️ *No mock test scores yet.* Use /score L R W S for more accurate analysis!`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}

function getTrend(current: number | undefined, previous: number | undefined): 'improving' | 'declining' | 'stable' | 'no_data' {
  if (current === undefined || current === null || previous === undefined || previous === null) return 'no_data';
  if (current > previous) return 'improving';
  if (current < previous) return 'declining';
  return 'stable';
}
