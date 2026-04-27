import Groq from 'groq-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ── Key pool with per-key cooldown ──

interface KeyState {
  key: string;
  client: Groq;
  cooldownUntil: number; // epoch ms — 0 means available
}

const KEY_COOLDOWN_MS = 60_000; // back off a rate-limited key for 60 s

let keyPool: KeyState[] = [];
let currentKeyIndex = 0;

function ensureKeyPool(): KeyState[] {
  if (keyPool.length > 0) return keyPool;
  keyPool = config.groqApiKeys.map(key => ({
    key,
    client: new Groq({ apiKey: key }),
    cooldownUntil: 0,
  }));
  if (keyPool.length > 0) {
    logger.info(`AI key pool initialised with ${keyPool.length} key(s)`);
  }
  return keyPool;
}

function getNextAvailableKey(): KeyState | null {
  const pool = ensureKeyPool();
  if (pool.length === 0) return null;

  const now = Date.now();

  // Try from currentKeyIndex, round-robin through entire pool
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % pool.length;
    if (pool[idx].cooldownUntil <= now) {
      currentKeyIndex = idx;
      return pool[idx];
    }
  }

  // All keys are on cooldown — pick the one that cools down soonest
  let earliest = pool[0];
  for (const ks of pool) {
    if (ks.cooldownUntil < earliest.cooldownUntil) earliest = ks;
  }
  return earliest;
}

function markKeyRateLimited(ks: KeyState): void {
  ks.cooldownUntil = Date.now() + KEY_COOLDOWN_MS;
  const masked = ks.key.slice(0, 8) + '…';
  logger.warn(`AI key ${masked} rate-limited, cooldown ${KEY_COOLDOWN_MS / 1000}s`);
  // Advance to next key
  currentKeyIndex = (keyPool.indexOf(ks) + 1) % keyPool.length;
}

function isRateLimitError(error: any): boolean {
  return (
    error?.status === 429 ||
    error?.statusCode === 429 ||
    error?.error?.code === 'rate_limit_exceeded' ||
    String(error?.message ?? '').includes('429') ||
    String(error?.message ?? '').includes('rate_limit')
  );
}

// ── Public API ──

export function getGroqClient(): Groq | null {
  const ks = getNextAvailableKey();
  return ks?.client ?? null;
}

export async function askAi(prompt: string, systemPrompt?: string): Promise<string> {
  const pool = ensureKeyPool();
  if (pool.length === 0) {
    return '❌ Vui lòng cấu hình GROQ_API_KEY trong file .env để sử dụng tính năng AI.';
  }

  const maxAttempts = Math.min(pool.length, 5);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ks = getNextAvailableKey();
    if (!ks) break;

    // Wait out remaining cooldown if every key was limited
    const waitMs = ks.cooldownUntil - Date.now();
    if (waitMs > 0) {
      await new Promise(r => setTimeout(r, waitMs));
    }

    try {
      const response = await ks.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are IELTS Buddy, a helpful, encouraging AI assistant for a student aiming for IELTS band 7.0. Be concise, accurate, and provide examples when explaining.'
          },
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
      });

      return response.choices[0]?.message?.content || '❌ AI không trả về kết quả.';
    } catch (error: any) {
      if (isRateLimitError(error)) {
        markKeyRateLimited(ks);
        // loop continues with next key
        continue;
      }
      logger.error('Groq API Error:', error);
      return '❌ Lỗi kết nối với AI. Vui lòng thử lại sau.';
    }
  }

  // All keys exhausted
  throw new RateLimitError('All Groq API keys are rate-limited. Please try again later.');
}
