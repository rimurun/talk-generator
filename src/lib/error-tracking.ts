// エラーの重要度定義
type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

interface ErrorReport {
  message: string;
  severity: ErrorSeverity;
  context?: Record<string, unknown>;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

/**
 * クライアントサイドのエラーをトラッキングする。
 * 将来的にSentry等の外部サービスに置き換え可能な抽象化。
 *
 * @param error - エラーオブジェクトまたはメッセージ文字列
 * @param severity - エラーの重要度（デフォルト: 'error'）
 * @param context - 追加のコンテキスト情報
 */
export function trackError(
  error: Error | string,
  severity: ErrorSeverity = 'error',
  context?: Record<string, unknown>
): void {
  const report: ErrorReport = {
    message: error instanceof Error ? error.message : error,
    severity,
    context: {
      ...(context || {}),
      stack: error instanceof Error ? error.stack : undefined,
    },
    timestamp: new Date().toISOString(),
    // ブラウザ環境でのみ取得
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // 重要度に応じてコンソール出力（将来: Sentry.captureException等に置換）
  if (severity === 'fatal' || severity === 'error') {
    console.error('[ErrorTracking]', report);
  } else {
    console.warn('[ErrorTracking]', report);
  }

  // LocalStorageにエラーログを保存（最大50件、古いものから削除）
  if (typeof window !== 'undefined') {
    try {
      const key = 'talkgen_error_log';
      const logs: ErrorReport[] = JSON.parse(localStorage.getItem(key) || '[]');
      logs.push(report);
      // 最大50件に制限して古いエントリを削除
      while (logs.length > 50) logs.shift();
      localStorage.setItem(key, JSON.stringify(logs));
    } catch {
      // StorageQuotaError等は無視してアプリの動作を継続する
    }
  }
}

/**
 * サーバーサイド（API Routes / Server Components）用のエラートラッキング。
 * Vercelのログに構造化JSON形式で出力する。
 *
 * @param error - エラーオブジェクトまたはメッセージ文字列
 * @param severity - エラーの重要度（デフォルト: 'error'）
 * @param context - 追加のコンテキスト情報
 */
export function trackServerError(
  error: Error | string,
  severity: ErrorSeverity = 'error',
  context?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  // Vercelのログで構造化検索が可能な形式で出力
  console.error(JSON.stringify({
    level: severity,
    message,
    stack,
    context,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * LocalStorageに保存されたエラーログを取得する（設定画面での表示用）。
 *
 * @returns エラーレポートの配列（サーバーサイドでは空配列）
 */
export function getErrorLogs(): ErrorReport[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('talkgen_error_log') || '[]');
  } catch {
    return [];
  }
}

/**
 * LocalStorageのエラーログをすべて削除する。
 */
export function clearErrorLogs(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('talkgen_error_log');
  }
}
