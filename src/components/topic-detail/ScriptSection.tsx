'use client';

import { Copy, Check } from 'lucide-react';

// カラークラスのマッピング型
export type ColorClass = 'blue' | 'red' | 'orange' | 'yellow' | 'green' | 'purple';

export interface ScriptSectionProps {
  title: string;
  content: string | undefined;
  colorClass?: ColorClass;
  onCopy: () => void;
  copySuccess: boolean;
  /** 編集モード対応 */
  isEditMode?: boolean;
  onEdit?: (value: string) => void;
}

// カラーごとのスタイル定義
const colorMap: Record<ColorClass, {
  bg: string;
  border: string;
  titleColor: string;
  accentColor: string;
  ring: string;
  btnBg: string;
}> = {
  blue:   {
    bg: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.2)',
    titleColor: '#93c5fd',
    accentColor: '#3b82f6',
    ring: 'focus:ring-blue-500',
    btnBg: 'rgba(59,130,246,0.1)',
  },
  red:    {
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.2)',
    titleColor: '#fca5a5',
    accentColor: '#ef4444',
    ring: 'focus:ring-red-500',
    btnBg: 'rgba(239,68,68,0.1)',
  },
  orange: {
    bg: 'rgba(249,115,22,0.06)',
    border: 'rgba(249,115,22,0.2)',
    titleColor: '#fdba74',
    accentColor: '#f97316',
    ring: 'focus:ring-orange-500',
    btnBg: 'rgba(249,115,22,0.1)',
  },
  yellow: {
    bg: 'rgba(234,179,8,0.06)',
    border: 'rgba(234,179,8,0.2)',
    titleColor: '#fde047',
    accentColor: '#eab308',
    ring: 'focus:ring-yellow-500',
    btnBg: 'rgba(234,179,8,0.1)',
  },
  green:  {
    bg: 'rgba(34,197,94,0.05)',
    border: 'rgba(34,197,94,0.2)',
    titleColor: '#86efac',
    accentColor: '#22c55e',
    ring: 'focus:ring-green-500',
    btnBg: 'rgba(34,197,94,0.1)',
  },
  purple: {
    bg: 'rgba(168,85,247,0.06)',
    border: 'rgba(168,85,247,0.2)',
    titleColor: '#d8b4fe',
    accentColor: '#a855f7',
    ring: 'focus:ring-purple-500',
    btnBg: 'rgba(168,85,247,0.1)',
  },
};

/** 台本の個別セクション表示（コピー・編集対応） */
export default function ScriptSection({
  title,
  content,
  colorClass = 'blue',
  onCopy,
  copySuccess,
  isEditMode = false,
  onEdit,
}: ScriptSectionProps) {
  if (!content && !isEditMode) return null;

  const colors = colorMap[colorClass];

  return (
    <div
      className="relative rounded-xl p-5 overflow-hidden"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* セクション左アクセントライン */}
          <div
            className="w-1 h-4 rounded flex-shrink-0"
            style={{ background: `linear-gradient(180deg, ${colors.accentColor}, ${colors.accentColor}88)` }}
          />
          <h3
            className="font-semibold text-sm"
            style={{ color: colors.titleColor }}
          >
            {title}
          </h3>
        </div>

        {/* コピーボタン（チェックマーク切り替えアニメーション） */}
        <button
          onClick={onCopy}
          aria-label={`${title}をコピー`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200 hover:text-white"
          style={{
            color: copySuccess ? '#4ade80' : colors.titleColor,
            background: colors.btnBg,
            border: `1px solid ${colors.border}`,
          }}
        >
          {copySuccess ? (
            <Check size={13} className="copy-success-icon" />
          ) : (
            <Copy size={13} />
          )}
          <span>{copySuccess ? 'コピー済' : 'コピー'}</span>
        </button>
      </div>

      {/* 編集モード: textarea / 通常モード: テキスト表示 */}
      {isEditMode ? (
        <textarea
          value={content || ''}
          onChange={(e) => onEdit?.(e.target.value)}
          className={`w-full px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-gray-200 leading-relaxed focus:outline-none focus:ring-2 ${colors.ring} resize-none text-sm`}
          rows={4}
        />
      ) : (
        <p className="text-gray-200 leading-relaxed text-sm">{content}</p>
      )}
    </div>
  );
}
