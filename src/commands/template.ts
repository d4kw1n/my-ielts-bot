import { Context, Markup } from 'telegraf';
import db from '../database/db';
import { Lang } from '../utils/i18n';

function getUserLang(telegramId: string): Lang {
  const user = db.prepare('SELECT language FROM users WHERE telegram_id = ?').get(telegramId) as any;
  return user?.language || 'vi';
}

const templates: Record<string, { name: string; nameVi: string; structure: string; structureVi: string; example: string }> = {
  agree_disagree: {
    name: '✅ Agree / Disagree',
    nameVi: '✅ Đồng ý / Không đồng ý',
    structure: `*TEMPLATE: Agree/Disagree*

📌 *Introduction (2-3 sentences):*
Paraphrase the question + State your opinion clearly.
_"It is often argued that [topic]. I completely agree/disagree with this statement because [reason 1] and [reason 2]."_

📌 *Body Paragraph 1 (5-6 sentences):*
Topic sentence → Explain → Example → Link back
_"The primary reason I support/oppose this is that [main argument]. This is because [explanation]. For instance, [specific example]. Therefore, [conclusion]."_

📌 *Body Paragraph 2 (5-6 sentences):*
Topic sentence → Explain → Example → Link back
_"Furthermore, [second argument]. [Explanation]. A clear example of this is [example]. As a result, [mini conclusion]."_

📌 *Conclusion (2 sentences):*
Restate opinion + Summarize key points
_"In conclusion, I firmly believe that [restate opinion] due to [reason 1] and [reason 2]."_

💡 *Key phrases:* I strongly believe, In my opinion, It is evident that, From my perspective`,
    structureVi: `*MẪU: Đồng ý / Không đồng ý*

📌 *Mở bài (2-3 câu):*
Diễn đạt lại đề bài + Nêu rõ quan điểm.
_"Nhiều người cho rằng [chủ đề]. Tôi hoàn toàn đồng ý/không đồng ý vì [lý do 1] và [lý do 2]."_

📌 *Thân bài 1 (5-6 câu):*
Câu chủ đề → Giải thích → Ví dụ → Liên kết
_"Lý do chính tôi ủng hộ/phản đối là [luận điểm]. Điều này bởi vì [giải thích]. Ví dụ, [ví dụ cụ thể]. Do đó, [kết luận nhỏ]."_

📌 *Thân bài 2 (5-6 câu):*
Câu chủ đề → Giải thích → Ví dụ → Liên kết

📌 *Kết bài (2 câu):*
Nhắc lại quan điểm + Tóm tắt lý do

💡 *Cụm từ hay:* I strongly believe, In my opinion, It is evident that, From my perspective`,
    example: 'Some people think that governments should spend money on public services rather than the arts. To what extent do you agree or disagree?',
  },
  discuss_both: {
    name: '💬 Discuss Both Views',
    nameVi: '💬 Thảo luận cả 2 quan điểm',
    structure: `*TEMPLATE: Discuss Both Views*

📌 *Introduction:*
Paraphrase + Mention both views + State which you support.
_"There are differing opinions on whether [topic]. While some believe [view 1], others argue [view 2]. This essay will discuss both perspectives before giving my own opinion."_

📌 *Body 1 — View A (5-6 sentences):*
_"On the one hand, proponents of [view A] argue that [argument]. This is supported by [evidence]. For example, [example]."_

📌 *Body 2 — View B + Your Opinion (5-6 sentences):*
_"On the other hand, those who favor [view B] contend that [argument]. [Explanation]. Personally, I tend to agree with this view because [your reason]."_

📌 *Conclusion:*
_"In conclusion, while both views have merit, I believe that [your position] because [brief summary]."_

💡 *Key phrases:* On the one hand... On the other hand, Proponents argue, It could be argued that, I tend to agree with`,
    structureVi: `*MẪU: Thảo luận cả 2 quan điểm*

📌 *Mở bài:*
Diễn đạt lại + Đề cập 2 quan điểm + Nêu quan điểm bạn ủng hộ.

📌 *Thân bài 1 — Quan điểm A (5-6 câu):*
_"Một mặt, những người ủng hộ [quan điểm A] cho rằng [luận điểm]. Điều này được hỗ trợ bởi [bằng chứng]."_

📌 *Thân bài 2 — Quan điểm B + Ý kiến bạn (5-6 câu):*
_"Mặt khác, những người ủng hộ [quan điểm B] cho rằng [luận điểm]. Cá nhân tôi đồng ý với quan điểm này vì [lý do]."_

📌 *Kết bài:*
_"Tóm lại, cả hai quan điểm đều có giá trị, nhưng tôi tin rằng [quan điểm] vì [tóm tắt]."_

💡 *Cụm từ:* On the one hand... On the other hand, Proponents argue, I tend to agree with`,
    example: 'Some people think children should start formal education at a very early age. Others think they should be free to play until they are older. Discuss both views and give your opinion.',
  },
  problem_solution: {
    name: '🔧 Problem / Solution',
    nameVi: '🔧 Vấn đề / Giải pháp',
    structure: `*TEMPLATE: Problem / Solution*

📌 *Introduction:*
State the problem + Briefly mention solutions.
_"[Topic] has become a significant concern in many countries. This essay will outline the main problems and propose viable solutions."_

📌 *Body 1 — Problems (5-6 sentences):*
_"The most pressing issue is [problem 1]. This leads to [consequence]. Additionally, [problem 2], which results in [impact]. For example, [specific evidence]."_

📌 *Body 2 — Solutions (5-6 sentences):*
_"To address these challenges, [solution 1] could be implemented. This would [benefit]. Furthermore, [solution 2] would help by [mechanism]. A successful example is [case study]."_

📌 *Conclusion:*
_"In conclusion, while [problems] pose serious challenges, they can be mitigated through [solutions summary]."_

💡 *Key phrases:* A significant concern, The root cause, To tackle this issue, A viable solution would be`,
    structureVi: `*MẪU: Vấn đề / Giải pháp*

📌 *Mở bài:* Nêu vấn đề + Đề cập giải pháp ngắn gọn.

📌 *Thân bài 1 — Vấn đề (5-6 câu):*
_"Vấn đề nghiêm trọng nhất là [vấn đề 1]. Điều này dẫn đến [hậu quả]. Ngoài ra, [vấn đề 2], gây ra [tác động]."_

📌 *Thân bài 2 — Giải pháp (5-6 câu):*
_"Để giải quyết, [giải pháp 1] có thể được triển khai. Điều này sẽ [lợi ích]. Hơn nữa, [giải pháp 2] sẽ giúp [cơ chế]."_

📌 *Kết bài:* Tóm lại vấn đề + giải pháp.

💡 *Cụm từ:* A significant concern, The root cause, To tackle this issue, A viable solution`,
    example: 'In many cities, traffic congestion is a growing problem. What are the causes, and what solutions can you suggest?',
  },
  advantages_disadvantages: {
    name: '⚖️ Advantages / Disadvantages',
    nameVi: '⚖️ Ưu điểm / Nhược điểm',
    structure: `*TEMPLATE: Advantages / Disadvantages*

📌 *Introduction:*
_"[Topic] has both positive and negative aspects. This essay will examine the advantages and disadvantages before presenting my own view."_

📌 *Body 1 — Advantages (5-6 sentences):*
_"The main benefit of [topic] is that [advantage 1]. This means [explanation]. Another advantage is [advantage 2]. For instance, [example]."_

📌 *Body 2 — Disadvantages (5-6 sentences):*
_"However, there are notable drawbacks. Firstly, [disadvantage 1] can lead to [negative consequence]. Moreover, [disadvantage 2]. Research shows that [evidence]."_

📌 *Conclusion:*
_"Overall, while [topic] offers [key advantage], the drawbacks of [key disadvantage] should not be overlooked. I believe the advantages outweigh/are outweighed by the disadvantages."_

💡 *Key phrases:* The primary benefit, A notable drawback, outweigh, On balance`,
    structureVi: `*MẪU: Ưu điểm / Nhược điểm*

📌 *Mở bài:* Giới thiệu chủ đề có cả mặt tích cực và tiêu cực.

📌 *Thân bài 1 — Ưu điểm:* Nêu 2 ưu điểm + giải thích + ví dụ.

📌 *Thân bài 2 — Nhược điểm:* Nêu 2 nhược điểm + hậu quả + bằng chứng.

📌 *Kết bài:* Ưu điểm có trội hơn nhược điểm không?

💡 *Cụm từ:* The primary benefit, A notable drawback, outweigh, On balance`,
    example: 'What are the advantages and disadvantages of working from home?',
  },
  two_part: {
    name: '❓ Two-Part Question',
    nameVi: '❓ Câu hỏi 2 phần',
    structure: `*TEMPLATE: Two-Part Question*

📌 *Introduction:*
Paraphrase both questions + Brief answer to each.
_"This essay will address [question 1] and [question 2]."_

📌 *Body 1 — Answer Question 1 (5-6 sentences):*
_"Regarding [question 1], I believe [your answer]. The main reason is [explanation]. For example, [evidence]."_

📌 *Body 2 — Answer Question 2 (5-6 sentences):*
_"As for [question 2], [your answer]. This is because [reason]. [Example]. Therefore, [conclusion]."_

📌 *Conclusion:*
Summarize answers to both questions.

💡 *Key phrases:* With regard to, As for, Turning to the second question, In terms of`,
    structureVi: `*MẪU: Câu hỏi 2 phần*

📌 *Mở bài:* Diễn đạt lại 2 câu hỏi + trả lời ngắn gọn.

📌 *Thân bài 1 — Trả lời câu 1 (5-6 câu):* Luận điểm + giải thích + ví dụ.

📌 *Thân bài 2 — Trả lời câu 2 (5-6 câu):* Luận điểm + giải thích + ví dụ.

📌 *Kết bài:* Tóm tắt cả 2 câu trả lời.

💡 *Cụm từ:* With regard to, As for, Turning to the second question`,
    example: 'Why do people choose to live in cities? What problems does this cause?',
  },
};

export function registerTemplateCommand(bot: any): void {
  bot.command('template', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);

    const msg = lang === 'vi'
      ? '📋 *MẪU CẤU TRÚC ESSAY IELTS TASK 2*\n━━━━━━━━━━━━━━━━━━━━━━\nChọn dạng đề để xem template:'
      : '📋 *IELTS TASK 2 ESSAY TEMPLATES*\n━━━━━━━━━━━━━━━━━━━━━━\nSelect essay type to view template:';

    const buttons = Object.entries(templates).map(([key, t]) =>
      [Markup.button.callback(lang === 'vi' ? t.nameVi : t.name, `tmpl_${key}`)]
    );

    await ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });

  bot.action(/^tmpl_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const key = match[1];
    await ctx.answerCbQuery();

    const tmpl = templates[key];
    if (!tmpl) return;

    const content = lang === 'vi' ? tmpl.structureVi : tmpl.structure;
    const exampleLabel = lang === 'vi' ? '📝 *Ví dụ đề bài:*' : '📝 *Example question:*';

    const msg = `${content}\n\n${exampleLabel}\n_${tmpl.example}_`;

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'vi' ? '✍️ Viết bài này ngay' : '✍️ Write this now', `tmpl_write_${key}`)],
        [Markup.button.callback(lang === 'vi' ? '⬅️ Xem dạng khác' : '⬅️ Other templates', 'tmpl_back')],
      ])
    });
  });

  bot.action(/^tmpl_write_(.+)$/, async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    const match = (ctx as any).match;
    const key = match[1];
    const tmpl = templates[key];
    await ctx.answerCbQuery();
    if (!tmpl) return;
    await ctx.reply(`/write ${tmpl.example}`);
  });

  bot.action('tmpl_back', async (ctx: Context) => {
    const telegramId = ctx.from!.id.toString();
    const lang = getUserLang(telegramId);
    await ctx.answerCbQuery();
    const buttons = Object.entries(templates).map(([key, t]) =>
      [Markup.button.callback(lang === 'vi' ? t.nameVi : t.name, `tmpl_${key}`)]
    );
    await ctx.editMessageText(
      lang === 'vi' ? '📋 Chọn dạng đề:' : '📋 Select essay type:',
      Markup.inlineKeyboard(buttons)
    );
  });
}
