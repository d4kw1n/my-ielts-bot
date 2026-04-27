import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function parseGroqApiKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  for (let i = 2; i <= 20; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

export const config = {
  // Telegram
  botToken: process.env.BOT_TOKEN || '',

  // Notion
  notionApiToken: process.env.NOTION_API_TOKEN || '',
  notionDatabaseId: process.env.NOTION_DATABASE_ID || '',

  // Google Calendar
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback',

  // Groq AI (supports multiple keys: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ...)
  groqApiKeys: parseGroqApiKeys(),

  // OAuth Server
  oauthPort: parseInt(process.env.OAUTH_PORT || '3000', 10),
  oauthBaseUrl: process.env.OAUTH_BASE_URL || 'http://localhost:3000',

  // Bot Settings
  defaultLanguage: (process.env.DEFAULT_LANGUAGE || 'vi') as 'vi' | 'en',
  timezone: process.env.TIMEZONE || 'Asia/Ho_Chi_Minh',

  // Database
  dbPath: path.resolve(__dirname, '..', 'data', 'ielts.db'),
};
