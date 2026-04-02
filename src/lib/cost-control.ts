// 日次コスト上限（デフォルト $5.00 / 環境変数で上書き可能）
const DAILY_COST_LIMIT = parseFloat(process.env.DAILY_COST_LIMIT || '5.0');
// 月次コスト上限（デフォルト $50.00 / 環境変数で上書き可能）
const MONTHLY_COST_LIMIT = parseFloat(process.env.MONTHLY_COST_LIMIT || '50.0');

/**
 * インメモリのコストトラッカー。
 * サーバーレス環境ではインスタンスが分散・再起動されるため、
 * これは「ベストエフォート」の防御策であり、完全な精度は保証しない。
 */
let dailyCosts: { date: string; total: number } = { date: '', total: 0 };
let monthlyCosts: { month: string; total: number } = { month: '', total: 0 };

/** 当日のキー（YYYY-MM-DD形式）を返す */
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 当月のキー（YYYY-MM形式）を返す */
function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * API呼び出しのコストを記録する。
 * API実行後にコスト確定値で呼び出す。
 *
 * @param cost - 今回のAPI呼び出しコスト（USD）
 */
export function recordCost(cost: number): void {
  const today = getTodayKey();
  const month = getMonthKey();

  // 日付が変わっていたら日次カウンターをリセット
  if (dailyCosts.date !== today) {
    dailyCosts = { date: today, total: 0 };
  }
  dailyCosts.total += cost;

  // 月が変わっていたら月次カウンターをリセット
  if (monthlyCosts.month !== month) {
    monthlyCosts = { month: month, total: 0 };
  }
  monthlyCosts.total += cost;
}

/**
 * コスト上限チェック。API呼び出し前に実行して超過を防ぐ。
 *
 * @returns 許可フラグ・理由・現在のコスト集計
 */
export function checkCostLimit(): {
  allowed: boolean;
  reason?: string;
  dailyTotal: number;
  monthlyTotal: number;
} {
  const today = getTodayKey();
  const month = getMonthKey();

  // 期間を跨いでいた場合はカウンターをリセット
  if (dailyCosts.date !== today) {
    dailyCosts = { date: today, total: 0 };
  }
  if (monthlyCosts.month !== month) {
    monthlyCosts = { month: month, total: 0 };
  }

  // 日次上限チェック（優先度高）
  if (dailyCosts.total >= DAILY_COST_LIMIT) {
    return {
      allowed: false,
      reason: `本日のAPI使用量が上限（$${DAILY_COST_LIMIT}）に達しました。明日リセットされます。`,
      dailyTotal: dailyCosts.total,
      monthlyTotal: monthlyCosts.total,
    };
  }

  // 月次上限チェック
  if (monthlyCosts.total >= MONTHLY_COST_LIMIT) {
    return {
      allowed: false,
      reason: `今月のAPI使用量が上限（$${MONTHLY_COST_LIMIT}）に達しました。`,
      dailyTotal: dailyCosts.total,
      monthlyTotal: monthlyCosts.total,
    };
  }

  return {
    allowed: true,
    dailyTotal: dailyCosts.total,
    monthlyTotal: monthlyCosts.total,
  };
}

/**
 * 現在のコスト統計と上限値を返す。
 * 使用量APIのレスポンスに含める用途を想定。
 */
export function getCostStats() {
  // 最新の期間キーで状態を整合させる
  const today = getTodayKey();
  const month = getMonthKey();

  if (dailyCosts.date !== today) {
    dailyCosts = { date: today, total: 0 };
  }
  if (monthlyCosts.month !== month) {
    monthlyCosts = { month: month, total: 0 };
  }

  return {
    daily: { ...dailyCosts, limit: DAILY_COST_LIMIT },
    monthly: { ...monthlyCosts, limit: MONTHLY_COST_LIMIT },
  };
}
