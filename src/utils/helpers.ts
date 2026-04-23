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
