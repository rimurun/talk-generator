'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Globe, Tag, Search } from 'lucide-react';
import { CategoryDetailFilter } from '@/types';

// カテゴリ別アクセントカラー定義
const categoryColors: Record<string, string> = {
  'ニュース':    '#00d4ff',
  'エンタメ':    '#ff00ff',
  'SNS':         '#00ff88',
  'TikTok':      '#aa00ff',
  '海外おもしろ': '#ff8800',
  '事件事故':    '#ff0044',
};

// カテゴリ別アイコン（絵文字）
const categoryIcons: Record<string, string> = {
  'ニュース':    '📰',
  'エンタメ':    '🎬',
  'SNS':         '📱',
  'TikTok':      '🎵',
  '海外おもしろ': '🌍',
  '事件事故':    '⚠️',
};

// カテゴリ別説明文
const categoryDescriptions: Record<string, string> = {
  'ニュース':    '最新の国内外ニュースを絞り込んで取得します',
  'エンタメ':    'アニメ・映画・音楽など、エンタメ情報を細かく指定できます',
  'SNS':         'X・Instagram・YouTubeなどのプラットフォーム動向を絞り込みます',
  'TikTok':      'TikTok固有のトレンドやチャレンジを詳細指定できます',
  '海外おもしろ': '海外の珍ニュースやユニークな話題を地域・期間で絞り込みます',
  '事件事故':    '事件・事故・災害情報を期間と地域で絞り込みます',
};

// カテゴリ別サブオプション定義
const categorySubOptions: Record<string, { label: string; value: string }[]> = {
  'ニュース': [
    { label: '政治',           value: 'politics' },
    { label: '経済',           value: 'economy' },
    { label: 'テクノロジー',   value: 'technology' },
    { label: '社会',           value: 'society' },
    { label: '国際',           value: 'international' },
    { label: 'スポーツ',       value: 'sports' },
  ],
  'エンタメ': [
    { label: 'アニメ',   value: 'anime' },
    { label: '映画',     value: 'movies' },
    { label: '音楽',     value: 'music' },
    { label: 'ゲーム',   value: 'games' },
    { label: '芸能',     value: 'celebrity' },
    { label: 'マンガ',   value: 'manga' },
  ],
  'SNS': [
    { label: 'X (Twitter)',  value: 'twitter' },
    { label: 'Instagram',    value: 'instagram' },
    { label: 'YouTube',      value: 'youtube' },
    { label: 'Threads',      value: 'threads' },
  ],
  'TikTok': [
    { label: 'チャレンジ',   value: 'challenge' },
    { label: 'バズ動画',     value: 'viral' },
    { label: 'トレンド音楽', value: 'music' },
    { label: 'ダンス',       value: 'dance' },
  ],
  '海外おもしろ': [
    { label: '珍事件',     value: 'weird' },
    { label: 'カルチャー', value: 'culture' },
    { label: '動物',       value: 'animals' },
    { label: '科学',       value: 'science' },
  ],
  '事件事故': [
    { label: '事件',   value: 'crime' },
    { label: '事故',   value: 'accident' },
    { label: '災害',   value: 'disaster' },
    { label: '国際',   value: 'international' },
  ],
};

// デフォルトフィルター値
const defaultDetail: CategoryDetailFilter = {
  timePeriod: 'today',
  region: 'both',
  subCategories: [],
};

interface CategoryDetailModalProps {
  category: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (category: string, detail: CategoryDetailFilter) => void;
  initialDetail?: CategoryDetailFilter;
}

export default function CategoryDetailModal({
  category,
  isOpen,
  onClose,
  onApply,
  initialDetail,
}: CategoryDetailModalProps) {
  const [detail, setDetail] = useState<CategoryDetailFilter>(
    initialDetail ?? { ...defaultDetail }
  );

  // モーダルが開くたびに初期値をリセット
  useEffect(() => {
    if (isOpen) {
      setDetail(initialDetail ?? { ...defaultDetail });
    }
  }, [isOpen, initialDetail]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const accentColor = categoryColors[category] ?? '#00d4ff';
  const icon = categoryIcons[category] ?? '◆';
  const description = categoryDescriptions[category] ?? '';
  const subOptions = categorySubOptions[category] ?? [];

  // サブカテゴリのトグル処理
  const toggleSubCategory = (value: string) => {
    setDetail(prev => ({
      ...prev,
      subCategories: prev.subCategories.includes(value)
        ? prev.subCategories.filter(v => v !== value)
        : [...prev.subCategories, value],
    }));
  };

  const handleApply = () => {
    onApply(category, detail);
  };

  // グローバルスタイル（キーフレームアニメーション用）
  const pulseKeyframes = `
    @keyframes neonPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes borderGlow {
      0%, 100% { box-shadow: 0 0 10px ${accentColor}60, 0 0 20px ${accentColor}30; }
      50% { box-shadow: 0 0 20px ${accentColor}80, 0 0 40px ${accentColor}40; }
    }
  `;

  if (!isOpen && !category) return null;

  return (
    <>
      {/* インラインスタイル（キーフレーム定義） */}
      <style>{pulseKeyframes}</style>

      {/* オーバーレイ背景 */}
      <div
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        onClick={(e) => {
          // 背景クリックで閉じる
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* モーダル本体 */}
        <div
          className={`relative w-full sm:max-w-lg sm:rounded-2xl overflow-hidden transition-all duration-300 ease-out ${
            isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(10,10,20,0.97) 0%, rgba(20,20,40,0.97) 100%)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${accentColor}50`,
            boxShadow: `0 0 40px ${accentColor}20, 0 25px 80px rgba(0,0,0,0.8), inset 0 1px 0 ${accentColor}30`,
            animation: isOpen ? 'borderGlow 3s ease-in-out infinite' : 'none',
          }}
        >
          {/* トップグロー装飾ライン */}
          <div
            style={{
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
              animation: 'neonPulse 2s ease-in-out infinite',
            }}
          />

          {/* スクロール可能なコンテンツエリア */}
          <div className="max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
            <div className="p-6">

              {/* ヘッダー行（閉じるボタン） */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${accentColor}40`,
                    color: accentColor,
                  }}
                  aria-label="閉じる"
                >
                  <X size={16} />
                </button>
              </div>

              {/* カテゴリ名とアイコン */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-3xl"
                    style={{ filter: `drop-shadow(0 0 8px ${accentColor})` }}
                  >
                    {icon}
                  </span>
                  <h2
                    className="text-2xl font-bold tracking-wide"
                    style={{
                      color: accentColor,
                      textShadow: `0 0 20px ${accentColor}80`,
                    }}
                  >
                    {category}
                  </h2>
                </div>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {description}
                </p>
              </div>

              {/* セクション区切り用コンポーネント */}
              {/* ── 期間 ────────────────── */}
              <div className="mb-6">
                <SectionLabel icon={<Clock size={14} />} label="期間" accentColor={accentColor} />
                <div className="flex gap-2 mt-3">
                  {([
                    { value: 'today', label: '今日' },
                    { value: 'week',  label: '今週' },
                    { value: 'month', label: '今月' },
                  ] as { value: CategoryDetailFilter['timePeriod']; label: string }[]).map(opt => (
                    <PillButton
                      key={opt.value}
                      label={opt.label}
                      selected={detail.timePeriod === opt.value}
                      accentColor={accentColor}
                      onClick={() => setDetail(prev => ({ ...prev, timePeriod: opt.value }))}
                    />
                  ))}
                </div>
              </div>

              {/* ── 地域 ────────────────── */}
              <div className="mb-6">
                <SectionLabel icon={<Globe size={14} />} label="地域" accentColor={accentColor} />
                <div className="flex gap-2 mt-3">
                  {([
                    { value: 'domestic',      label: '国内' },
                    { value: 'international', label: '海外' },
                    { value: 'both',          label: '両方' },
                  ] as { value: CategoryDetailFilter['region']; label: string }[]).map(opt => (
                    <PillButton
                      key={opt.value}
                      label={opt.label}
                      selected={detail.region === opt.value}
                      accentColor={accentColor}
                      onClick={() => setDetail(prev => ({ ...prev, region: opt.value }))}
                    />
                  ))}
                </div>
              </div>

              {/* ── サブカテゴリ ─────────── */}
              {subOptions.length > 0 && (
                <div className="mb-8">
                  <SectionLabel icon={<Tag size={14} />} label="サブカテゴリ（複数選択可）" accentColor={accentColor} />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {subOptions.map(opt => (
                      <SmallPillButton
                        key={opt.value}
                        label={opt.label}
                        selected={detail.subCategories.includes(opt.value)}
                        accentColor={accentColor}
                        onClick={() => toggleSubCategory(opt.value)}
                      />
                    ))}
                  </div>
                  {detail.subCategories.length > 0 && (
                    <p
                      className="text-xs mt-2"
                      style={{ color: `${accentColor}99` }}
                    >
                      {detail.subCategories.length}件選択中
                    </p>
                  )}
                </div>
              )}

              {/* 区切り線 */}
              <div
                className="mb-5"
                style={{
                  height: '1px',
                  background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)`,
                }}
              />

              {/* 適用ボタン */}
              <button
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-base tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}40)`,
                  border: `1px solid ${accentColor}80`,
                  color: accentColor,
                  boxShadow: `0 0 20px ${accentColor}30, inset 0 0 20px ${accentColor}10`,
                  animation: 'borderGlow 2s ease-in-out infinite',
                  textShadow: `0 0 10px ${accentColor}80`,
                }}
              >
                <Search size={18} />
                この条件で検索
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── サブコンポーネント ────────────────────────────────────────────────

/** セクションラベル */
function SectionLabel({
  icon,
  label,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  accentColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: accentColor }}>{icon}</span>
      <span
        className="text-xs font-semibold tracking-widest uppercase"
        style={{ color: `${accentColor}cc` }}
      >
        {label}
      </span>
      <div
        className="flex-1"
        style={{
          height: '1px',
          background: `linear-gradient(90deg, ${accentColor}40, transparent)`,
        }}
      />
    </div>
  );
}

/** 通常サイズピルボタン（期間・地域）*/
function PillButton({
  label,
  selected,
  accentColor,
  onClick,
}: {
  label: string;
  selected: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`,
              border: `1px solid ${accentColor}`,
              color: accentColor,
              boxShadow: `0 0 15px ${accentColor}40, 0 0 30px ${accentColor}20`,
              textShadow: `0 0 8px ${accentColor}80`,
            }
          : {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)',
            }
      }
    >
      {label}
    </button>
  );
}

/** 小サイズピルボタン（サブカテゴリ）*/
function SmallPillButton({
  label,
  selected,
  accentColor,
  onClick,
}: {
  label: string;
  selected: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${accentColor}35, ${accentColor}15)`,
              border: `1px solid ${accentColor}90`,
              color: accentColor,
              boxShadow: `0 0 10px ${accentColor}30`,
            }
          : {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.45)',
            }
      }
    >
      {label}
    </button>
  );
}
