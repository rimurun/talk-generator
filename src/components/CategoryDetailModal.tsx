'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

  // モーダル本体への参照（フォーカストラップで使用）
  const modalRef = useRef<HTMLDivElement>(null);
  // オーバーレイへの参照（スクロール位置リセット用）
  const overlayRef = useRef<HTMLDivElement>(null);

  // モーダルが開くたびに初期値をリセット + スクロール位置リセット
  // 注: bodyのスクロールロックはFilterPanel側で管理済み（このモーダルはFilterPanelの上に重なる）
  useEffect(() => {
    if (isOpen) {
      setDetail(initialDetail ?? { ...defaultDetail });
      // オーバーレイのスクロール位置を最上部にリセット
      requestAnimationFrame(() => {
        overlayRef.current?.scrollTo(0, 0);
      });
    }
  }, [isOpen, initialDetail]);

  // フォーカストラップ（ESCで閉じる + Tabキーをモーダル内に制限）
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // フォーカス可能な要素を取得
    const getFocusableElements = () => {
      return modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // モーダルを開いた時に最初のフォーカス可能要素へ移動
    const firstFocusable = getFocusableElements()[0];
    if (firstFocusable) firstFocusable.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
    // フィルターを適用してからモーダルを閉じる
    onApply(category, detail);
    onClose();
  };

  // キーフレームアニメーション（CSS-only）
  const keyframes = `
    @keyframes neonPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes modalSlideUp {
      from { transform: translateY(60px) scale(0.96); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes modalScaleDown {
      from { transform: translateY(0) scale(1); opacity: 1; }
      to { transform: translateY(40px) scale(0.95); opacity: 0; }
    }
    @keyframes borderGlow {
      0%, 100% { box-shadow: 0 0 30px ${accentColor}25, 0 25px 80px rgba(0,0,0,0.8), inset 0 1px 0 ${accentColor}30; }
      50% { box-shadow: 0 0 50px ${accentColor}40, 0 25px 80px rgba(0,0,0,0.8), inset 0 1px 0 ${accentColor}50; }
    }
    @keyframes iconFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    @keyframes chipSelect {
      0% { transform: scale(0.95); }
      60% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    .modal-open {
      animation: modalSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .icon-float {
      animation: iconFloat 3s ease-in-out infinite;
    }
    .chip-selected {
      animation: chipSelect 0.25s ease-out forwards;
    }
  `;

  // category が空文字の場合はレンダリングしない（isOpen に関わらず）
  if (!category) return null;
  if (!isOpen) return null;

  // Portal: document.body直下にレンダリングし、親のtransform/backdrop-filterの影響を回避
  return createPortal(
    <>
      {/* インラインスタイル（キーフレーム定義） */}
      <style>{keyframes}</style>

      {/* フルスクリーンオーバーレイ（fixed + inset:0 で確実にビューポート全体をカバー） */}
      <div
        ref={overlayRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          backgroundColor: 'rgba(0, 0, 0, 0.98)',
          padding: '24px 16px',
        }}
      >
        {/* モーダル本体 */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="カテゴリ詳細フィルター"
          aria-labelledby="category-detail-modal-title"
          className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden modal-open"
          style={{
            background: 'linear-gradient(145deg, rgba(8,8,18,0.98) 0%, rgba(15,15,30,0.98) 50%, rgba(8,8,18,0.98) 100%)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: `1px solid ${accentColor}45`,
            // 条件分岐不要。isOpenのときのみレンダリングされるため常にアニメーションを適用
            animation: `modalSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, borderGlow 3s ease-in-out infinite 0.35s`,
          }}
        >
          {/* トップグロー装飾ライン */}
          <div
            style={{
              height: '2px',
              background: `linear-gradient(90deg, transparent 0%, ${accentColor}80 20%, ${accentColor} 50%, ${accentColor}80 80%, transparent 100%)`,
              animation: 'neonPulse 2.5s ease-in-out infinite',
            }}
          />

          {/* 右下装飾グロー */}
          <div
            className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accentColor}08 0%, transparent 70%)`,
            }}
          />

          {/* スクロール可能なコンテンツエリア */}
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="p-5">

              {/* ヘッダー行（閉じるボタン） */}
              <div className="flex justify-end mb-3">
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 hover:rotate-90"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${accentColor}35`,
                    color: `${accentColor}cc`,
                  }}
                  aria-label="閉じる"
                >
                  <X size={15} />
                </button>
              </div>

              {/* カテゴリ名とアイコン */}
              <div className="mb-6 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-2">
                  {/* アイコン */}
                  <div
                    className="icon-float flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}08)`,
                      border: `1px solid ${accentColor}40`,
                      boxShadow: `0 0 20px ${accentColor}20, inset 0 0 20px ${accentColor}08`,
                      filter: `drop-shadow(0 0 12px ${accentColor}50)`,
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <h2
                      id="category-detail-modal-title"
                      className="text-2xl font-black tracking-wide mb-1"
                      style={{
                        color: accentColor,
                        textShadow: `0 0 30px ${accentColor}70, 0 0 60px ${accentColor}30`,
                      }}
                    >
                      {category}
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {description}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 期間 ────────────────── */}
              <div className="mb-6">
                <SectionLabel icon={<Clock size={13} />} label="期間" accentColor={accentColor} />
                <div className="flex gap-2.5 mt-3">
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
                <SectionLabel icon={<Globe size={13} />} label="地域" accentColor={accentColor} />
                <div className="flex gap-2.5 mt-3">
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
                <div className="mb-6">
                  <SectionLabel icon={<Tag size={13} />} label="サブカテゴリ（複数選択可）" accentColor={accentColor} />
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
                      className="text-xs mt-2.5 font-medium"
                      style={{ color: `${accentColor}aa` }}
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
                  background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
                }}
              />

              {/* 適用ボタン（グラデーション＋ホバースケール） */}
              <button
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-sm tracking-wider transition-all duration-200 active:scale-[0.97]"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}25, ${accentColor}45)`,
                  border: `1px solid ${accentColor}70`,
                  color: accentColor,
                  boxShadow: `0 0 24px ${accentColor}25, inset 0 0 24px ${accentColor}08`,
                  textShadow: `0 0 12px ${accentColor}80`,
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.transform = 'translateY(-2px) scale(1.02)';
                  btn.style.boxShadow = `0 8px 32px ${accentColor}40, inset 0 0 32px ${accentColor}12`;
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.transform = 'translateY(0) scale(1)';
                  btn.style.boxShadow = `0 0 24px ${accentColor}25, inset 0 0 24px ${accentColor}08`;
                }}
              >
                <Search size={18} />
                この条件で検索
              </button>

            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
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
      <span style={{ color: `${accentColor}cc` }}>{icon}</span>
      <span
        className="text-xs font-bold tracking-widest uppercase"
        style={{ color: `${accentColor}bb` }}
      >
        {label}
      </span>
      <div
        className="flex-1"
        style={{
          height: '1px',
          background: `linear-gradient(90deg, ${accentColor}35, transparent)`,
        }}
      />
    </div>
  );
}

/** 通常サイズピルボタン（期間・地域）
 * 選択時はカラーフィル＋グロー、未選択はフラットな半透明スタイル
 */
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
      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-250 ${selected ? 'chip-selected' : ''}`}
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${accentColor}45, ${accentColor}25)`,
              border: `1px solid ${accentColor}cc`,
              color: accentColor,
              boxShadow: `0 0 16px ${accentColor}40, 0 0 32px ${accentColor}20, inset 0 0 16px ${accentColor}12`,
              textShadow: `0 0 10px ${accentColor}90`,
            }
          : {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.45)',
            }
      }
      onMouseEnter={(e) => {
        if (!selected) {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = 'rgba(255,255,255,0.06)';
          btn.style.borderColor = `${accentColor}40`;
          btn.style.color = 'rgba(255,255,255,0.7)';
          btn.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = 'rgba(255,255,255,0.03)';
          btn.style.borderColor = 'rgba(255,255,255,0.09)';
          btn.style.color = 'rgba(255,255,255,0.45)';
          btn.style.transform = 'translateY(0)';
        }
      }}
    >
      {label}
    </button>
  );
}

/** 小サイズピルボタン（サブカテゴリ）
 * チップ型デザイン。選択状態は滑らかなカラートランジション
 */
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
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${selected ? 'chip-selected' : ''}`}
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`,
              border: `1px solid ${accentColor}aa`,
              color: accentColor,
              boxShadow: `0 0 12px ${accentColor}35, inset 0 0 8px ${accentColor}10`,
              textShadow: `0 0 8px ${accentColor}80`,
            }
          : {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
            }
      }
      onMouseEnter={(e) => {
        if (!selected) {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = `${accentColor}12`;
          btn.style.borderColor = `${accentColor}50`;
          btn.style.color = `${accentColor}cc`;
          btn.style.transform = 'scale(1.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = 'rgba(255,255,255,0.03)';
          btn.style.borderColor = 'rgba(255,255,255,0.1)';
          btn.style.color = 'rgba(255,255,255,0.4)';
          btn.style.transform = 'scale(1)';
        }
      }}
    >
      {label}
    </button>
  );
}
