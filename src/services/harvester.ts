import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import db from '../database/db';
import { askAi } from './ai_service';
import { logger } from '../utils/logger';

/**
 * IELTS Question Harvester — Auto-collects questions from:
 * 1. Free IELTS practice websites (scraping)
 * 2. AI bulk generation by topic × band
 * 3. RSS/news feeds turned into reading comprehension
 */

// === Sources to crawl ===
const IELTS_SOURCES = [
  // --- English News & Academic ---
  {
    name: 'BBC Learning English',
    url: 'https://www.bbc.co.uk/learningenglish/english/features/6-minute-english',
    type: 'article' as const,
    topics: ['technology', 'environment', 'society', 'health', 'education'],
  },
  {
    name: 'The Guardian - Science',
    url: 'https://www.theguardian.com/science',
    type: 'article' as const,
    topics: ['science'],
  },
  {
    name: 'The Guardian - Environment',
    url: 'https://www.theguardian.com/environment',
    type: 'article' as const,
    topics: ['environment'],
  },
  {
    name: 'BBC News - Technology',
    url: 'https://www.bbc.com/news/technology',
    type: 'article' as const,
    topics: ['technology'],
  },
  {
    name: 'National Geographic',
    url: 'https://www.nationalgeographic.com/environment',
    type: 'article' as const,
    topics: ['environment', 'science'],
  },
  {
    name: 'Scientific American',
    url: 'https://www.scientificamerican.com',
    type: 'article' as const,
    topics: ['science', 'technology', 'health'],
  },
  {
    name: 'The Economist - Finance',
    url: 'https://www.economist.com/finance-and-economics',
    type: 'article' as const,
    topics: ['economics', 'work'],
  },
  // --- Vietnamese IELTS Sites ---
  {
    name: 'IELTS Fighter',
    url: 'https://ieltsfighter.com/reading-luyen-thi-ielts/',
    type: 'article' as const,
    topics: ['education', 'society'],
  },
  {
    name: 'DOL English',
    url: 'https://dolenglish.vn/blog',
    type: 'article' as const,
    topics: ['education', 'technology'],
  },
  {
    name: 'ZIM Academy',
    url: 'https://zim.vn/ielts-reading',
    type: 'article' as const,
    topics: ['education', 'environment'],
  },
  {
    name: 'IELTS Vietop',
    url: 'https://vietop.edu.vn/blog/',
    type: 'article' as const,
    topics: ['education', 'society'],
  },
];

// Famous IELTS book templates — AI generates questions in these styles
const BOOK_TEMPLATES = [
  {
    book: 'Cambridge IELTS 14-19',
    style: 'Academic reading passages from Cambridge official tests. Passages are 700-900 words, topics include archaeology, marine biology, urban planning, cognitive psychology, agricultural science. Questions include True/False/Not Given, matching headings, sentence completion, multiple choice, and summary completion.',
    topics: ['science', 'history', 'psychology', 'environment', 'technology', 'society'],
    bands: [6.0, 6.5, 7.0, 7.5, 8.0],
  },
  {
    book: 'Collins Reading for IELTS',
    style: 'Skill-building reading exercises focusing on scanning, skimming, and inference. Topics include health care systems, renewable energy, education reforms, digital communication. Questions progress from B1 to C1 level.',
    topics: ['health', 'environment', 'education', 'technology'],
    bands: [5.0, 5.5, 6.0, 6.5],
  },
  {
    book: 'Cambridge Vocabulary for IELTS Advanced',
    style: 'Topic-based vocabulary in academic context. Tests collocations, word families, synonyms in context, and academic word list usage. Topics include globalization, biotechnology, urbanization, media influence.',
    topics: ['economics', 'science', 'society', 'technology', 'environment'],
    bands: [6.5, 7.0, 7.5, 8.0],
  },
  {
    book: 'Cambridge Grammar for IELTS',
    style: 'Grammar exercises testing complex structures: conditionals, relative clauses, passive constructions, reported speech, articles, noun phrases. Contexts are academic and semi-formal.',
    topics: ['grammar'],
    bands: [5.5, 6.0, 6.5, 7.0],
  },
  {
    book: 'Barrons Essential Words for IELTS',
    style: 'Vocabulary building with 600 essential words organized by topic. Tests meaning in context, word formation, and usage in academic sentences.',
    topics: ['education', 'health', 'environment', 'technology', 'work', 'society'],
    bands: [5.0, 5.5, 6.0, 6.5],
  },
  {
    book: 'IELTS Trainer 2 (Cambridge)',
    style: 'Full test practice with guided exercises. Reading passages cover diverse topics: animal behavior, space exploration, linguistic research, architectural design. Includes all IELTS question types.',
    topics: ['science', 'art', 'history', 'environment'],
    bands: [6.0, 6.5, 7.0, 7.5],
  },
  {
    book: 'Target Band 7 (Simone Braverman)',
    style: 'Strategy-focused practice. Questions designed to test common mistakes at band 6-7 level. Focus on tricky vocabulary, confusing grammar patterns, and reading trap answers.',
    topics: ['education', 'health', 'work', 'society', 'technology'],
    bands: [6.0, 6.5, 7.0],
  },
];

// Topics × Band matrix for comprehensive AI generation
const GENERATION_MATRIX = {
  topics: [
    'environment', 'technology', 'education', 'health', 'work',
    'society', 'science', 'art', 'travel', 'economics',
    'psychology', 'history', 'urbanization', 'media', 'crime',
    'globalization', 'food', 'sports', 'space', 'language'
  ],
  bands: [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
  types: ['vocabulary', 'grammar', 'reading'] as const,
};

// === Deduplication ===
function contentHash(question: string): string {
  return crypto.createHash('md5').update(question.toLowerCase().trim()).digest('hex');
}

function isDuplicate(hash: string): boolean {
  const existing = db.prepare('SELECT id FROM question_bank WHERE content_hash = ?').get(hash);
  return !!existing;
}

// === Web Article Scraper ===
async function scrapeArticleLinks(sourceUrl: string, maxLinks: number = 3): Promise<string[]> {
  try {
    const { data } = await axios.get(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IELTSBuddy/1.0)' },
      timeout: 15000,
    });
    const $ = cheerio.load(data);

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      // Filter: only article-like links, skip navigation/category
      if (href && (href.includes('/article') || href.includes('/news/') || href.match(/\/\d{4}\//))) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, sourceUrl).toString();
        if (!links.includes(fullUrl) && links.length < maxLinks) {
          links.push(fullUrl);
        }
      }
    });

    return links;
  } catch (e) {
    logger.error(`Failed to scrape ${sourceUrl}: ${(e as Error).message}`);
    return [];
  }
}

async function extractArticleText(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IELTSBuddy/1.0)' },
      timeout: 15000,
    });
    const $ = cheerio.load(data);
    $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();

    const title = $('h1').first().text().trim() || $('title').text().trim();
    const paragraphs: string[] = [];
    $('article p, .article-body p, .content p, main p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30) paragraphs.push(text);
    });

    // Fallback: get all body paragraphs
    if (paragraphs.length < 2) {
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) paragraphs.push(text);
      });
    }

    const fullText = paragraphs.join('\n\n');
    if (fullText.length < 100) return null;

    return { title, text: fullText.substring(0, 4000) };
  } catch (e) {
    logger.error(`Failed to extract article from ${url}: ${(e as Error).message}`);
    return null;
  }
}

// === AI Question Generation from Article ===
async function generateQuestionsFromArticle(article: { title: string; text: string }, sourceUrl: string, topics: string[]): Promise<number> {
  const prompt = `You are an expert IELTS examiner. Based on this article, generate 5 high-quality IELTS practice questions.

Article Title: "${article.title}"
Article Text (excerpt):
"""
${article.text.substring(0, 3000)}
"""

Generate a MIX of question types:
- 2 vocabulary questions (ask meaning of advanced words from the text)
- 1 grammar question (based on sentence structures in the text)  
- 2 reading comprehension questions (include a short passage excerpt from the text)

Return ONLY a valid JSON array:
[
  {
    "type": "vocabulary" | "grammar" | "reading",
    "level": "B1" | "B2" | "C1" | "C2",
    "topic": "${topics[0] || 'general'}",
    "question": "The question in English",
    "question_vi": "Vietnamese translation of the question",
    "options": ["A", "B", "C", "D"],
    "answer": 0,
    "band": 6.5,
    "explanation": "Brief explanation of the correct answer"
  }
]`;

  try {
    const response = await askAi(prompt, 'You output pure JSON arrays only. No markdown.');
    if (response.startsWith('❌')) return 0;

    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;

    const questions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions)) return 0;

    return saveQuestions(questions, 'harvester_article', sourceUrl);
  } catch (e) {
    logger.error(`AI question gen failed: ${(e as Error).message}`);
    return 0;
  }
}

// === Bulk AI Generation by Topic × Band ===
async function generateBulkQuestions(topic: string, band: number, count: number = 5): Promise<number> {
  const prompt = `Generate ${count} high-quality IELTS practice questions.

Requirements:
- Topic: ${topic}
- Target band: ${band}
- Mix types: 2 vocabulary + 1 grammar + 2 reading (include short passages)
- Questions should test real IELTS skills, not just definitions
- For vocabulary: test collocations, context usage, or synonyms
- For grammar: test complex structures appropriate for band ${band}
- For reading: include a 30-50 word passage followed by a comprehension question

Return ONLY a valid JSON array:
[
  {
    "type": "vocabulary" | "grammar" | "reading",
    "level": "${band >= 7.0 ? 'C1' : band >= 6.0 ? 'B2' : 'B1'}",
    "topic": "${topic}",
    "question": "Question in English",
    "question_vi": "Vietnamese translation",
    "options": ["A", "B", "C", "D"],
    "answer": 0,
    "band": ${band},
    "explanation": "Brief explanation"
  }
]`;

  try {
    const response = await askAi(prompt, 'You output pure JSON arrays only.');
    if (response.startsWith('❌')) return 0;

    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;

    const questions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions)) return 0;

    return saveQuestions(questions, `ai_bulk_${topic}`, '');
  } catch (e) {
    logger.error(`Bulk generation failed for ${topic}@${band}: ${(e as Error).message}`);
    return 0;
  }
}

// === Save with Deduplication ===
function saveQuestions(questions: any[], source: string, sourceUrl: string): number {
  let saved = 0;

  const insert = db.prepare(`
    INSERT INTO question_bank (type, level, question, question_vi, options, answer, band, explanation, created_by, source_url, content_hash, topic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: any[]) => {
    for (const q of items) {
      if (!q.type || !q.question || !Array.isArray(q.options) || q.answer === undefined) continue;

      const hash = contentHash(q.question);
      if (isDuplicate(hash)) continue;

      try {
        insert.run(
          q.type,
          q.level || 'B2',
          q.question,
          q.question_vi || '',
          JSON.stringify(q.options),
          q.answer.toString(),
          q.band || 6.0,
          q.explanation || '',
          source,
          sourceUrl,
          hash,
          q.topic || ''
        );
        saved++;
      } catch (e) {
        // Silently skip insert errors (e.g. constraint violations)
      }
    }
  });

  insertMany(questions);
  return saved;
}

// === Main Orchestrator ===
export async function runHarvester(): Promise<{ articlesProcessed: number; questionsGenerated: number }> {
  logger.info('🤖 [Harvester] Starting question harvesting run...');
  let totalArticles = 0;
  let totalQuestions = 0;

  // Phase 1: Scrape articles from news sources and generate questions
  for (const source of IELTS_SOURCES) {
    try {
      const links = await scrapeArticleLinks(source.url, 2);
      logger.info(`[Harvester] Found ${links.length} articles from ${source.name}`);

      for (const link of links) {
        // Skip if we already processed this URL recently
        const existingFromUrl = db.prepare('SELECT id FROM question_bank WHERE source_url = ? LIMIT 1').get(link);
        if (existingFromUrl) continue;

        const article = await extractArticleText(link);
        if (!article) continue;

        const count = await generateQuestionsFromArticle(article, link, source.topics);
        totalArticles++;
        totalQuestions += count;
        logger.info(`[Harvester] Generated ${count} questions from: ${article.title}`);

        // Rate limiting: wait 2s between AI calls
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      logger.error(`[Harvester] Error processing source ${source.name}: ${(e as Error).message}`);
    }
  }

  // Phase 2: Fill gaps in the topic × band matrix
  const coverageStats = db.prepare(`
    SELECT topic, band, COUNT(*) as cnt FROM question_bank 
    WHERE topic != '' AND topic IS NOT NULL
    GROUP BY topic, band
  `).all() as any[];

  const coverageMap: Record<string, number> = {};
  for (const row of coverageStats) {
    coverageMap[`${row.topic}_${row.band}`] = row.cnt;
  }

  // Find topic × band combos with < 5 questions
  for (const topic of GENERATION_MATRIX.topics) {
    for (const band of GENERATION_MATRIX.bands) {
      const key = `${topic}_${band}`;
      const current = coverageMap[key] || 0;

      if (current < 5) {
        const needed = 5 - current;
        const count = await generateBulkQuestions(topic, band, needed);
        totalQuestions += count;
        logger.info(`[Harvester] Filled gap: ${topic}@${band} +${count} questions (was ${current})`);

        // Rate limiting
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // Phase 3: Generate questions in the style of famous IELTS books
  for (const book of BOOK_TEMPLATES) {
    const count = await generateBookStyleQuestions(book);
    totalQuestions += count;
    logger.info(`[Harvester] Book-style (${book.book}): +${count} questions`);
    await new Promise(r => setTimeout(r, 2000));
  }

  logger.info(`🤖 [Harvester] Completed! Articles: ${totalArticles}, New Questions: ${totalQuestions}`);
  return { articlesProcessed: totalArticles, questionsGenerated: totalQuestions };
}

// === Generate questions styled after famous IELTS books ===
async function generateBookStyleQuestions(book: typeof BOOK_TEMPLATES[0]): Promise<number> {
  let total = 0;
  // Pick a random topic and band from this book's range
  const topic = book.topics[Math.floor(Math.random() * book.topics.length)];
  const band = book.bands[Math.floor(Math.random() * book.bands.length)];

  const prompt = `You are creating practice questions in the style of "${book.book}".

Style description: ${book.style}

Generate 5 high-quality IELTS practice questions.
- Topic: ${topic}
- Target band: ${band}
- Mix: 2 vocabulary (collocations/context) + 1 grammar (complex structure) + 2 reading (with 40-60 word passage each)
- Make questions feel authentic to the book style described above
- For vocabulary: test academic words, collocations, synonyms in context
- For reading: include a short passage excerpt then ask comprehension

Return ONLY a valid JSON array:
[
  {
    "type": "vocabulary" | "grammar" | "reading",
    "level": "${band >= 7.0 ? 'C1' : band >= 6.0 ? 'B2' : 'B1'}",
    "topic": "${topic}",
    "question": "Question in English",
    "question_vi": "Vietnamese translation",
    "options": ["A", "B", "C", "D"],
    "answer": 0,
    "band": ${band},
    "explanation": "Brief explanation"
  }
]`;

  try {
    const response = await askAi(prompt, 'You output pure JSON arrays only.');
    if (response.startsWith('❌')) return 0;
    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;
    const questions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions)) return 0;
    total = saveQuestions(questions, `book_${book.book.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`, '');
  } catch (e) {
    logger.error(`Book-style generation failed for ${book.book}: ${(e as Error).message}`);
  }
  return total;
}

// === Generate for a single topic across all bands ===
export async function generateBulkForTopic(topic: string): Promise<number> {
  let total = 0;
  for (const band of GENERATION_MATRIX.bands) {
    const count = await generateBulkQuestions(topic, band, 5);
    total += count;
    await new Promise(r => setTimeout(r, 1500));
  }
  logger.info(`[Harvester] Generated ${total} questions for topic: ${topic}`);
  return total;
}

// === Stats for admin reporting ===
export function getQuestionBankStats(): { total: number; byType: Record<string, number>; byTopic: Record<string, number>; bySource: Record<string, number> } {
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM question_bank').get() as any).cnt;

  const byTypeRows = db.prepare('SELECT type, COUNT(*) as cnt FROM question_bank GROUP BY type').all() as any[];
  const byType: Record<string, number> = {};
  for (const row of byTypeRows) byType[row.type] = row.cnt;

  const byTopicRows = db.prepare("SELECT topic, COUNT(*) as cnt FROM question_bank WHERE topic != '' AND topic IS NOT NULL GROUP BY topic ORDER BY cnt DESC").all() as any[];
  const byTopic: Record<string, number> = {};
  for (const row of byTopicRows) byTopic[row.topic] = row.cnt;

  const bySourceRows = db.prepare("SELECT created_by, COUNT(*) as cnt FROM question_bank WHERE created_by IS NOT NULL GROUP BY created_by").all() as any[];
  const bySource: Record<string, number> = {};
  for (const row of bySourceRows) bySource[row.created_by] = row.cnt;

  return { total, byType, byTopic, bySource };
}
