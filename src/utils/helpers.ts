import { config } from '../config';

// ── Timezone helpers (always returns Vietnam / configured TZ) ──

export function getVietnamNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: config.timezone }));
}

export function getVietnamToday(): string {
  const now = getVietnamNow();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getVietnamTime(): string {
  const now = getVietnamNow();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function getVietnamYesterday(): string {
  const now = getVietnamNow();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getVietnamTomorrow(): string {
  const now = getVietnamNow();
  now.setDate(now.getDate() + 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getVietnamDaysAgo(days: number): string {
  const now = getVietnamNow();
  now.setDate(now.getDate() - days);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getVietnamDaysLater(days: number): string {
  const now = getVietnamNow();
  now.setDate(now.getDate() + days);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getVietnamDayOfWeek(): number {
  return getVietnamNow().getDay();
}

/** Fisher-Yates shuffle — uniform distribution */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Progress bar utility for Telegram messages
export function progressBar(current: number, target: number, length: number = 10): string {
  const percentage = Math.min(Math.round((current / target) * 100), 100);
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${bar} ${percentage}%`;
}

export function bandToPercentage(current: number, target: number): number {
  // Map band scores to a normalized percentage toward target
  // IELTS bands: 0 - 9, but realistic range is 3.0 - 9.0
  const minBand = 3.0;
  const progressRange = target - minBand;
  const currentProgress = current - minBand;
  return Math.min(Math.round((currentProgress / progressRange) * 100), 100);
}

export function overallBand(l: number, r: number, w: number, s: number): number {
  // IELTS overall band calculation - average rounded to nearest 0.5
  const avg = (l + r + w + s) / 4;
  return Math.round(avg * 2) / 2;
}

export function getSkillEmoji(skill: string): string {
  const emojis: Record<string, string> = {
    listening: '🎧',
    reading: '📖',
    writing: '✍️',
    speaking: '🗣️',
    vocabulary: '📚',
    grammar: '📝',
    all: '📊',
    overall: '📊',
  };
  return emojis[skill.toLowerCase()] || '📌';
}

export function getTrendEmoji(current: number, previous: number): string {
  if (current > previous) return '📈 ↑';
  if (current < previous) return '📉 ↓';
  return '➡️ →';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function getPhaseInfo(phase: number): { name: string; nameVi: string; description: string; descriptionVi: string } {
  const phases: Record<number, { name: string; nameVi: string; description: string; descriptionVi: string }> = {
    1: {
      name: '🌱 Foundation',
      nameVi: '🌱 Nền tảng',
      description: 'Build core English skills, learn test format, daily vocabulary',
      descriptionVi: 'Xây dựng nền tảng, làm quen format đề, từ vựng hàng ngày',
    },
    2: {
      name: '🔥 Intensive Practice',
      nameVi: '🔥 Luyện tập chuyên sâu',
      description: 'Cambridge practice tests, timed exercises, essay writing',
      descriptionVi: 'Luyện đề Cambridge, bài tập bấm giờ, viết essay',
    },
    3: {
      name: '🎯 Mock Test & Refine',
      nameVi: '🎯 Thi thử & Hoàn thiện',
      description: 'Full mock tests, error analysis, test strategies',
      descriptionVi: 'Thi thử full, phân tích lỗi, chiến lược thi',
    },
  };
  return phases[phase] || phases[1];
}
