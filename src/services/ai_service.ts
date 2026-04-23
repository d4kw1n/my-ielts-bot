import Groq from 'groq-sdk';
import { config } from '../config';

let groqClient: Groq | null = null;

// Custom error for rate limiting — callers can catch this to stop retrying
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function getGroqClient(): Groq | null {
  if (!config.groqApiKey) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey: config.groqApiKey });
  }
  return groqClient;
}

export async function askAi(prompt: string, systemPrompt?: string): Promise<string> {
  const client = getGroqClient();
  if (!client) {
    return '❌ Vui lòng cấu hình GROQ_API_KEY trong file .env để sử dụng tính năng AI.';
  }

  try {
    const response = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt || 'You are IELTS Buddy, a helpful, encouraging AI assistant for a student aiming for IELTS band 7.0. Be concise, accurate, and provide examples when explaining.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      // Llama 3.3 70B is high quality and free on Groq
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || '❌ AI không trả về kết quả.';
  } catch (error: any) {
    console.error('Groq API Error:', error);
    // Detect rate limit (429) and throw specific error
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('rate_limit')) {
      throw new RateLimitError('Groq API rate limit exceeded');
    }
    return '❌ Lỗi kết nối với AI. Vui lòng thử lại sau.';
  }
}

