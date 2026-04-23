import db from '../database/db';
import fs from 'fs';
import path from 'path';
import placementQuestions from './placement-questions.json';

interface Resource {
  skill: string;
  category: string;
  name: string;
  url: string;
  description: string;
  description_vi: string;
  difficulty: string;
  is_free: boolean;
}

const resources: Resource[] = [
  // ===== LISTENING =====
  // Websites
  { skill: 'listening', category: 'website', name: 'IELTS.org Official', url: 'https://www.ielts.org', description: 'Official IELTS practice tests - authentic exam materials', description_vi: 'Đề thi IELTS chính thức - tài liệu thi thật', difficulty: 'all', is_free: true },
  { skill: 'listening', category: 'website', name: 'Mini-IELTS', url: 'https://mini-ielts.com', description: 'Free listening practice tests with various topics', description_vi: 'Đề luyện nghe miễn phí đa dạng chủ đề', difficulty: 'all', is_free: true },
  { skill: 'listening', category: 'website', name: 'British Council IELTS Ready', url: 'https://takeielts.britishcouncil.org', description: 'Official BC practice platform with interactive exercises', description_vi: 'Nền tảng luyện thi chính thức của BC', difficulty: 'all', is_free: true },
  { skill: 'listening', category: 'website', name: 'BBC Learning English', url: 'https://www.bbc.co.uk/learningenglish', description: '6 Minute English, News Review - great for daily listening', description_vi: '6 Minute English, News Review - nghe hàng ngày', difficulty: 'intermediate', is_free: true },
  { skill: 'listening', category: 'website', name: 'TED Talks', url: 'https://www.ted.com', description: 'Academic listening practice with diverse topics', description_vi: 'Luyện nghe academic với nhiều chủ đề', difficulty: 'advanced', is_free: true },
  { skill: 'listening', category: 'website', name: 'IELTS Liz', url: 'https://ieltsliz.com', description: 'Expert strategies and tips for IELTS Listening', description_vi: 'Chiến lược và mẹo nghe IELTS từ chuyên gia', difficulty: 'all', is_free: true },
  // Books
  { skill: 'listening', category: 'book', name: 'Cambridge IELTS 17-19', url: '', description: 'Latest authentic Cambridge practice tests', description_vi: 'Đề thi Cambridge mới nhất - tài liệu chính thống', difficulty: 'all', is_free: false },
  { skill: 'listening', category: 'book', name: 'Collins Listening for IELTS', url: '', description: 'Systematic listening skill development', description_vi: 'Phát triển kỹ năng nghe có hệ thống', difficulty: 'intermediate', is_free: false },
  { skill: 'listening', category: 'book', name: 'IELTS Trainer 2 Academic', url: '', description: '6 practice tests with detailed guidance', description_vi: '6 bài test kèm hướng dẫn chi tiết', difficulty: 'advanced', is_free: false },

  // ===== READING =====
  // Websites
  { skill: 'reading', category: 'website', name: 'Mini-IELTS', url: 'https://mini-ielts.com', description: 'Hundreds of free reading practice tests', description_vi: 'Hàng trăm đề Reading miễn phí', difficulty: 'all', is_free: true },
  { skill: 'reading', category: 'website', name: 'IELTS Liz', url: 'https://ieltsliz.com', description: 'Reading strategies and band 7+ tips', description_vi: 'Chiến lược đọc và tips đạt band 7+', difficulty: 'all', is_free: true },
  { skill: 'reading', category: 'website', name: 'ReadTheory', url: 'https://readtheory.org', description: 'Adaptive reading comprehension practice', description_vi: 'Luyện đọc hiểu thích ứng theo trình độ', difficulty: 'all', is_free: true },
  { skill: 'reading', category: 'website', name: 'The Guardian', url: 'https://www.theguardian.com', description: 'Read quality journalism to improve vocabulary', description_vi: 'Đọc báo chất lượng để nâng cao từ vựng', difficulty: 'advanced', is_free: true },
  { skill: 'reading', category: 'website', name: 'BestMyTest', url: 'https://www.bestmytest.com', description: 'Comprehensive practice tests with study plans', description_vi: 'Đề luyện thi toàn diện kèm kế hoạch học', difficulty: 'all', is_free: true },
  // Books
  { skill: 'reading', category: 'book', name: 'Cambridge IELTS 17-19', url: '', description: 'Authentic reading passages with answer keys', description_vi: 'Bài đọc thật kèm đáp án', difficulty: 'all', is_free: false },
  { skill: 'reading', category: 'book', name: 'Collins Reading for IELTS', url: '', description: 'Step-by-step reading skill improvement', description_vi: 'Cải thiện kỹ năng đọc từng bước', difficulty: 'intermediate', is_free: false },
  { skill: 'reading', category: 'book', name: 'The Official Cambridge Guide to IELTS', url: '', description: 'Comprehensive guide with 8 full tests', description_vi: 'Hướng dẫn toàn diện với 8 bài test đầy đủ', difficulty: 'all', is_free: false },
  { skill: 'reading', category: 'book', name: 'Target Band 7 - Simone Braverman', url: '', description: 'Practical tips for reaching band 7.0', description_vi: 'Mẹo thực tế để đạt band 7.0', difficulty: 'intermediate', is_free: false },

  // ===== WRITING =====
  // Websites
  { skill: 'writing', category: 'website', name: 'IELTS Liz', url: 'https://ieltsliz.com', description: 'Model answers and essay structures for band 7+', description_vi: 'Bài mẫu và cấu trúc essay band 7+', difficulty: 'all', is_free: true },
  { skill: 'writing', category: 'website', name: 'IELTS Simon', url: 'https://ielts-simon.com', description: 'Band 9 model answers with detailed explanations', description_vi: 'Bài mẫu band 9 với giải thích chi tiết', difficulty: 'advanced', is_free: true },
  { skill: 'writing', category: 'website', name: 'Write & Improve (Cambridge)', url: 'https://writeandimprove.com', description: 'AI-powered writing checker and scorer', description_vi: 'Kiểm tra và chấm writing bằng AI', difficulty: 'all', is_free: true },
  { skill: 'writing', category: 'website', name: 'English AIdol', url: 'https://englishaidol.com', description: 'AI feedback for IELTS Writing tasks', description_vi: 'Phản hồi AI cho bài Writing IELTS', difficulty: 'all', is_free: true },
  { skill: 'writing', category: 'website', name: 'Grammarly', url: 'https://www.grammarly.com', description: 'Grammar and vocabulary checker', description_vi: 'Kiểm tra ngữ pháp và từ vựng', difficulty: 'all', is_free: true },
  // Books
  { skill: 'writing', category: 'book', name: 'Collins Writing for IELTS', url: '', description: 'Complete writing guide with model answers', description_vi: 'Hướng dẫn Writing đầy đủ kèm bài mẫu', difficulty: 'intermediate', is_free: false },
  { skill: 'writing', category: 'book', name: 'Cambridge Vocabulary for IELTS Advanced', url: '', description: 'Advanced vocabulary in context for Writing', description_vi: 'Từ vựng nâng cao theo ngữ cảnh cho Writing', difficulty: 'advanced', is_free: false },
  { skill: 'writing', category: 'book', name: 'Cambridge Grammar for IELTS', url: '', description: 'Complex grammar structures for higher bands', description_vi: 'Cấu trúc ngữ pháp phức tạp cho band cao', difficulty: 'intermediate', is_free: false },
  { skill: 'writing', category: 'book', name: 'IELTS Writing Task 1+2 - Mat Clark', url: '', description: 'Popular Vietnamese-recommended Writing guide', description_vi: 'Sách Writing phổ biến cho người Việt', difficulty: 'intermediate', is_free: false },

  // ===== SPEAKING =====
  // Websites
  { skill: 'speaking', category: 'website', name: 'IELTS Liz', url: 'https://ieltsliz.com', description: 'Speaking samples and band descriptors', description_vi: 'Mẫu Speaking và mô tả các band điểm', difficulty: 'all', is_free: true },
  { skill: 'speaking', category: 'website', name: 'ELSA Speak', url: 'https://elsaspeak.com', description: 'AI-powered pronunciation training', description_vi: 'Luyện phát âm bằng AI', difficulty: 'all', is_free: true },
  { skill: 'speaking', category: 'website', name: 'Cambly', url: 'https://www.cambly.com', description: 'Practice speaking with native speakers', description_vi: 'Luyện nói với người bản xứ', difficulty: 'all', is_free: false },
  { skill: 'speaking', category: 'website', name: 'English AIdol', url: 'https://englishaidol.com', description: 'AI-powered speaking practice and feedback', description_vi: 'Luyện nói và nhận phản hồi bằng AI', difficulty: 'all', is_free: true },
  { skill: 'speaking', category: 'website', name: 'IELTSMate', url: 'https://ieltsmate.net', description: 'Mock speaking tests with AI scoring', description_vi: 'Test speaking giả lập với chấm điểm AI', difficulty: 'all', is_free: true },
  // Books
  { skill: 'speaking', category: 'book', name: 'Collins Speaking for IELTS', url: '', description: 'Systematic speaking skill development', description_vi: 'Phát triển kỹ năng nói có hệ thống', difficulty: 'intermediate', is_free: false },
  { skill: 'speaking', category: 'book', name: 'IELTS Speaking - Mat Clark', url: '', description: 'Comprehensive Speaking guide with sample answers', description_vi: 'Hướng dẫn Speaking toàn diện kèm câu trả lời mẫu', difficulty: 'intermediate', is_free: false },

  // ===== VOCABULARY & GRAMMAR =====
  { skill: 'vocabulary', category: 'website', name: 'Quizlet', url: 'https://quizlet.com', description: 'IELTS flashcard sets for vocabulary', description_vi: 'Bộ flashcard từ vựng IELTS', difficulty: 'all', is_free: true },
  { skill: 'vocabulary', category: 'website', name: 'Anki', url: 'https://apps.ankiweb.net', description: 'Spaced repetition flashcard system', description_vi: 'Hệ thống flashcard lặp lại cách quãng', difficulty: 'all', is_free: true },
  { skill: 'vocabulary', category: 'website', name: 'Cambridge Dictionary', url: 'https://dictionary.cambridge.org', description: 'Dictionary with IELTS word lists', description_vi: 'Từ điển kèm danh sách từ IELTS', difficulty: 'all', is_free: true },
  { skill: 'vocabulary', category: 'book', name: 'Cambridge Vocabulary for IELTS Advanced', url: '', description: 'Topic-based vocabulary for band 6.5+', description_vi: 'Từ vựng theo chủ đề cho band 6.5+', difficulty: 'advanced', is_free: false },
  { skill: 'vocabulary', category: 'book', name: 'Barron\'s Essential Words for IELTS', url: '', description: '600 essential words with practice exercises', description_vi: '600 từ thiết yếu kèm bài tập', difficulty: 'intermediate', is_free: false },
  { skill: 'grammar', category: 'book', name: 'Cambridge Grammar for IELTS', url: '', description: 'Essential grammar with IELTS practice', description_vi: 'Ngữ pháp cần thiết kèm bài tập IELTS', difficulty: 'intermediate', is_free: false },
  { skill: 'grammar', category: 'book', name: 'English Grammar in Use - Raymond Murphy', url: '', description: 'The classic grammar reference book', description_vi: 'Sách ngữ pháp kinh điển', difficulty: 'intermediate', is_free: false },

  // ===== ALL-IN-ONE / COMPREHENSIVE =====
  { skill: 'all', category: 'book', name: 'The Official Cambridge Guide to IELTS', url: '', description: 'Best all-in-one book: tips, strategies, 8 full tests', description_vi: 'Sách tốt nhất all-in-one: tips, chiến lược, 8 bài test', difficulty: 'all', is_free: false },
  { skill: 'all', category: 'book', name: 'Barron\'s IELTS Superpack', url: '', description: 'Multi-book resource with strategies and practice exams', description_vi: 'Bộ sách đa năng với chiến lược và đề thi', difficulty: 'all', is_free: false },
  { skill: 'all', category: 'book', name: 'Target Band 7 - Simone Braverman', url: '', description: 'Practical strategies to break the 7.0 barrier', description_vi: 'Chiến lược thực tế để phá rào 7.0', difficulty: 'intermediate', is_free: false },
  { skill: 'all', category: 'website', name: 'Magoosh IELTS', url: 'https://magoosh.com/ielts', description: 'Free full-length practice test with score report', description_vi: 'Bài test full miễn phí kèm báo cáo điểm', difficulty: 'all', is_free: true },
];

export function seedResources(): void {
  const insert = db.prepare(`
    INSERT INTO resources (skill, category, name, url, description, description_vi, difficulty, is_free)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: Resource[]) => {
    for (const item of items) {
      insert.run(item.skill, item.category, item.name, item.url, item.description, item.description_vi, item.difficulty, item.is_free ? 1 : 0);
    }
  });

  insertMany(resources);
  console.log(`📚 Seeded ${resources.length} resources`);
}

export function seedQuestions(): void {
  try {
    const questions = placementQuestions;
    
    const insert = db.prepare(`
      INSERT INTO question_bank (type, level, question, question_vi, options, answer, band)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        insert.run(
          item.type, 
          item.level, 
          item.question, 
          item.question_vi || '', 
          JSON.stringify(item.options), 
          item.answer.toString(), 
          item.band
        );
      }
    });

    insertMany(questions);
    console.log(`📝 Seeded ${questions.length} questions into question_bank`);
  } catch (err) {
    console.error('Failed to seed questions:', err);
  }
}
