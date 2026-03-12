// 日次レート制限管理
// 1日100回制限、午前0時（JST）でリセット
// GPT-4o-miniコスト試算: 約$0.0014/回 × 100回/日 × 30日 = $4.20/月（$33予算内）

const DAILY_LIMIT = 100;

interface DailyUsage {
  date: string; // YYYY-MM-DD (JST)
  topicCount: number;
  scriptCount: number;
  totalGenerations: number;
}

const STORAGE_KEY = 'talk-generator-daily-usage';

function getJSTDateString(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

function getUsage(): DailyUsage {
  if (typeof window === 'undefined') {
    return { date: getJSTDateString(), topicCount: 0, scriptCount: 0, totalGenerations: 0 };
  }
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return { date: getJSTDateString(), topicCount: 0, scriptCount: 0, totalGenerations: 0 };
  }
  const usage: DailyUsage = JSON.parse(data);
  // 日付変わったらリセット
  if (usage.date !== getJSTDateString()) {
    return { date: getJSTDateString(), topicCount: 0, scriptCount: 0, totalGenerations: 0 };
  }
  return usage;
}

export function getRateLimit() {
  const usage = getUsage();
  return {
    currentCount: usage.totalGenerations,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - usage.totalGenerations),
    isLimited: usage.totalGenerations >= DAILY_LIMIT,
  };
}

export function incrementUsage(type: 'topic' | 'script') {
  if (typeof window === 'undefined') return getRateLimit();
  const usage = getUsage();
  if (usage.totalGenerations >= DAILY_LIMIT) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    return { ...getRateLimit(), isLimited: true };
  }
  if (type === 'topic') usage.topicCount++;
  else usage.scriptCount++;
  usage.totalGenerations++;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  return getRateLimit();
}

export function isRateLimited(): boolean {
  return getRateLimit().isLimited;
}

export function getTimeUntilReset(): string {
  const now = new Date();
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const tomorrow = new Date(jstNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const ms = tomorrow.getTime() - jstNow.getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}
