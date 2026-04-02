import { describe, it, expect, beforeEach } from 'vitest';
import { trackError, getErrorLogs, clearErrorLogs } from '../error-tracking';

// error-tracking.ts は localStorage にログを蓄積するため、
// beforeEach でクリアしてテスト間の干渉を防ぐ。

describe('error-tracking', () => {
  beforeEach(() => {
    clearErrorLogs();
  });

  it('エラーを記録してログから取得できる', () => {
    trackError('テストエラー', 'error');
    const logs = getErrorLogs();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[logs.length - 1].message).toBe('テストエラー');
  });

  it('Errorオブジェクトを受け取れる', () => {
    trackError(new Error('テスト例外'), 'warning');
    const logs = getErrorLogs();
    expect(logs[logs.length - 1].message).toBe('テスト例外');
  });

  it('clearErrorLogsでログがクリアされる', () => {
    trackError('消えるエラー');
    clearErrorLogs();
    const logs = getErrorLogs();
    expect(logs).toHaveLength(0);
  });
});
