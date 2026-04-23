import { askAi } from './ai_service';
import db from '../database/db';

export async function generateNewQuestions(count: number = 3): Promise<void> {
  const prompt = `You are an expert IELTS examiner and curriculum designer. 
Generate exactly ${count} multiple-choice questions for IELTS preparation.
Cover different skills (vocabulary, grammar, reading) and different bands (5.0 to 8.5).
For reading questions, YOU MUST INCLUDE A SHORT READING PASSAGE (30-50 words) IN THE QUESTION TEXT.

You MUST respond ONLY with a valid JSON array of objects. Do not wrap in markdown or add explanations.

Schema for each object:
{
  "type": "vocabulary" | "grammar" | "reading",
  "level": "B1" | "B2" | "C1" | "C2",
  "question": "The question in English (include passage here if reading)",
  "question_vi": "The question translated to Vietnamese (include passage in English, followed by translated question)",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": 0 | 1 | 2 | 3 (the index of the correct option),
  "band": 5.0 to 8.5 (number)
}

Example Reading Question:
{
  "type": "reading",
  "level": "C1",
  "question": "Read: 'Despite the economic downturn, the company managed to maintain its profitability through cost-cutting measures.'\\n\\nWhat helped the company?",
  "question_vi": "Đọc: 'Despite the economic downturn, the company managed to maintain its profitability through cost-cutting measures.'\\n\\nĐiều gì đã giúp công ty?",
  "options": ["Prices", "Cost cutting", "Loans", "Hiring"],
  "answer": 1,
  "band": 7.0
}`;

  try {
    const response = await askAi(prompt, 'You are an AI that outputs pure JSON arrays only. No markdown, no conversational text.');
    
    if (response.startsWith('❌')) {
      console.error('AI Generation blocked:', response);
      return;
    }

    // Clean up potential markdown formatting from AI
    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions = JSON.parse(jsonStr);

    if (Array.isArray(questions)) {
      const insert = db.prepare(`
        INSERT INTO question_bank (type, level, question, question_vi, options, answer, band, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ai')
      `);

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
        }
      });

      insertMany(questions);
      console.log(`🤖 AI successfully generated and saved ${questions.length} new questions.`);
    }
  } catch (error) {
    console.error('Failed to generate questions via AI:', error);
  }
}

export function checkAndRefillQuestionBank(): void {
  const countObj = db.prepare('SELECT COUNT(*) as cnt FROM question_bank').get() as any;
  // If we have less than 50 questions, generate more in the background
  if (countObj && countObj.cnt < 50) {
    console.log(`Question bank running low (${countObj.cnt} questions). Triggering AI generation...`);
    generateNewQuestions(5).catch(console.error);
  }
}
