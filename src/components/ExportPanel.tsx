'use client';

import { useState } from 'react';
import { Script, Topic } from '@/types';
import { X, Copy, Download, Monitor, Link, Check } from 'lucide-react';

interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  script: Script;
  topic: Topic;
}

// コピー成功状態を管理するキーの型
type CopyKey = 'text' | 'markdown' | 'obsUrl' | 'shareUrl' | null;

export default function ExportPanel({ isOpen, onClose, script, topic }: ExportPanelProps) {
  // OBS 設定
  const [obsFontSize, setObsFontSize] = useState('24');
  const [obsColor, setObsColor] = useState('white');
  const [obsBg, setObsBg] = useState('transparent');
  const [obsScroll, setObsScroll] = useState(false);
  const [obsUrl, setObsUrl] = useState('');
  const [obsSent, setObsSent] = useState(false);

  // コピー成功フィードバック
  const [copySuccess, setCopySuccess] = useState<CopyKey>(null);

  // 共有URL
  const [shareUrl, setShareUrl] = useState('');

  // テキスト形式でエクスポート用の文字列を生成
  const formatAsPlainText = (): string => {
    const c = script.content;
    if (topic.category === '事件事故') {
      return `【${topic.title}】
カテゴリ: ${topic.category}

--- 台本 ---

事実報告:
${c.factualReport || ''}

状況説明:
${c.seriousContext || ''}

注意事項:
${c.avoidanceNotes || ''}

出典: ${topic.sourceUrl}`;
    }

    return `【${topic.title}】
カテゴリ: ${topic.category}

--- 台本 ---

つかみ:
${c.opening || ''}

説明:
${c.explanation || ''}

コメント:
${c.streamerComment || ''}

視聴者への質問:
${(c.viewerQuestions || []).join('\n')}

話の広げ方:
${(c.expansions || []).join('\n')}

繋ぎ:
${c.transition || ''}

出典: ${topic.sourceUrl}`;
  };

  // Markdown 形式でエクスポート用の文字列を生成
  const formatAsMarkdown = (): string => {
    const c = script.content;
    if (topic.category === '事件事故') {
      return `# ${topic.title}

**カテゴリ:** ${topic.category}

---

## 事実報告
${c.factualReport || ''}

## 状況説明
${c.seriousContext || ''}

## 注意事項
${c.avoidanceNotes || ''}

---

**出典:** ${topic.sourceUrl}`;
    }

    return `# ${topic.title}

**カテゴリ:** ${topic.category}

---

## つかみ
${c.opening || ''}

## ざっくり説明
${c.explanation || ''}

## 配信者コメント
${c.streamerComment || ''}

## 視聴者への質問
${(c.viewerQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}

## 話の広げ方
${(c.expansions || []).map((e, i) => `${i + 1}. ${e}`).join('\n')}

## 次の話題への繋ぎ
${c.transition || ''}

---

**出典:** ${topic.sourceUrl}`;
  };

  // クリップボードにコピー
  const copyToClipboard = async (text: string, key: CopyKey) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
    }
  };

  // ファイルダウンロード（Blob経由）
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ファイル名のサニタイズ（使用不可な文字を除去）
  const sanitizeFilename = (name: string): string => {
    return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
  };

  // OBS Browser Source URL を生成
  const generateObsUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      fs: obsFontSize,
      color: obsColor,
      bg: obsBg,
      scroll: obsScroll ? 'true' : 'false',
    });
    const url = `${baseUrl}/api/obs?${params.toString()}`;
    setObsUrl(url);
    return url;
  };

  // OBS にスクリプトデータを送信（localStorageに書き込み）
  const sendToObs = () => {
    const obsData = {
      title: topic.title,
      ...script.content,
    };
    localStorage.setItem('talkgen_obs_script', JSON.stringify(obsData));
    setObsSent(true);
    setTimeout(() => setObsSent(false), 3000);
  };

  // 共有リンクを生成（Base64エンコードされたURLパラメータ）
  const generateShareUrl = () => {
    try {
      const shareData = {
        title: topic.title,
        category: topic.category,
        content: script.content,
      };
      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      const url = `${window.location.origin}?share=${encoded}`;
      setShareUrl(url);
      copyToClipboard(url, 'shareUrl');
    } catch (err) {
      console.error('共有URLの生成に失敗しました:', err);
    }
  };

  return (
    <>
      {/* バックドロップオーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* スライドインパネル */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="エクスポートパネル"
        aria-modal="true"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-white">エクスポート</h2>
          <button
            onClick={onClose}
            aria-label="パネルを閉じる"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* スクロール可能なコンテンツエリア */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* ---- クリップボードセクション ---- */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Copy size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">クリップボード</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(formatAsPlainText(), 'text')}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                {copySuccess === 'text' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copySuccess === 'text' ? 'コピーしました' : 'テキストコピー'}
              </button>
              <button
                onClick={() => copyToClipboard(formatAsMarkdown(), 'markdown')}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                {copySuccess === 'markdown' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copySuccess === 'markdown' ? 'コピーしました' : 'Markdownコピー'}
              </button>
            </div>
          </section>

          {/* ---- ファイル保存セクション ---- */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Download size={16} className="text-green-400" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">ファイル保存</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadFile(
                  formatAsPlainText(),
                  `${sanitizeFilename(topic.title)}.txt`,
                  'text/plain;charset=utf-8'
                )}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Download size={14} />
                .txt 保存
              </button>
              <button
                onClick={() => downloadFile(
                  formatAsMarkdown(),
                  `${sanitizeFilename(topic.title)}.md`,
                  'text/markdown;charset=utf-8'
                )}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Download size={14} />
                .md 保存
              </button>
            </div>
          </section>

          {/* ---- OBS連携セクション ---- */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={16} className="text-cyan-400" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">OBS 連携</h3>
            </div>
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-4">

              {/* OBS 設定フィールド */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 w-28 shrink-0">フォントサイズ</label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      value={obsFontSize}
                      onChange={(e) => setObsFontSize(e.target.value)}
                      min="12"
                      max="72"
                      className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <span className="text-xs text-gray-400">px</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 w-28 shrink-0">文字色</label>
                  <input
                    type="text"
                    value={obsColor}
                    onChange={(e) => setObsColor(e.target.value)}
                    placeholder="white / #ffffff"
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 w-28 shrink-0">背景色</label>
                  <input
                    type="text"
                    value={obsBg}
                    onChange={(e) => setObsBg(e.target.value)}
                    placeholder="transparent / #000000"
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 w-28 shrink-0">自動スクロール</label>
                  <button
                    onClick={() => setObsScroll(prev => !prev)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      obsScroll ? 'bg-cyan-600' : 'bg-gray-600'
                    }`}
                    aria-pressed={obsScroll}
                    aria-label="自動スクロールを切り替え"
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        obsScroll ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-gray-400">{obsScroll ? 'ON' : 'OFF'}</span>
                </div>
              </div>

              {/* URL 生成ボタン */}
              <button
                onClick={generateObsUrl}
                className="w-full bg-cyan-700 hover:bg-cyan-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                URLを生成
              </button>

              {/* 生成済みURL表示 */}
              {obsUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={obsUrl}
                      readOnly
                      className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-gray-300 text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(obsUrl, 'obsUrl')}
                      className="shrink-0 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                      aria-label="OBS URLをコピー"
                    >
                      {copySuccess === 'obsUrl' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    OBS Studio → ソース → ブラウザ → URLに貼り付け
                  </p>
                </div>
              )}

              {/* OBS に送信ボタン */}
              <button
                onClick={sendToObs}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  obsSent
                    ? 'bg-green-700 text-white'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                }`}
              >
                <Monitor size={14} />
                {obsSent ? '送信しました（5秒で自動更新）' : 'OBSに送信'}
              </button>
              {obsSent && (
                <p className="text-xs text-green-400 text-center">
                  台本データをブラウザに保存しました。OBSのBrowser SourceはURLを開いていれば自動更新されます。
                </p>
              )}
            </div>
          </section>

          {/* ---- 共有リンクセクション ---- */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Link size={16} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">共有リンク</h3>
            </div>
            <button
              onClick={generateShareUrl}
              className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              {copySuccess === 'shareUrl' ? (
                <>
                  <Check size={14} className="text-green-400" />
                  URLをコピーしました
                </>
              ) : (
                <>
                  <Link size={14} />
                  共有リンクを生成してコピー
                </>
              )}
            </button>
            {shareUrl && copySuccess !== 'shareUrl' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-gray-300 text-xs focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(shareUrl, 'shareUrl')}
                  className="shrink-0 p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  aria-label="共有URLをコピー"
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              台本データをURLに埋め込んでシェアします
            </p>
          </section>

        </div>
      </div>
    </>
  );
}
