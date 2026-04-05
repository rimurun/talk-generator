'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FilterOptions, CategoryDetailFilter } from '@/types';
import { categoryOptions, durationOptions, tensionOptions, tonePresets } from '@/lib/mock-data';
import {
  Settings, Sparkles, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, X,
  Zap, Layers
} from 'lucide-react';

// カテゴリごとのグラデーション定義
const CATEGORY_GRADIENTS: Record<string, { gradient: string; glowColor: string; textClass: string }> = {
  'ニュース':     { gradient: 'from-cyan-500/20 to-blue-600/20',    glowColor: 'rgba(0,212,255,0.15)',   textClass: 'text-cyan-300' },
  'エンタメ':     { gradient: 'from-pink-500/20 to-rose-600/20',    glowColor: 'rgba(255,0,102,0.15)',   textClass: 'text-pink-300' },
  'SNS':         { gradient: 'from-purple-500/20 to-violet-600/20', glowColor: 'rgba(139,92,246,0.15)',  textClass: 'text-purple-300' },
  'TikTok':      { gradient: 'from-red-500/20 to-orange-500/20',    glowColor: 'rgba(239,68,68,0.15)',   textClass: 'text-red-300' },
  'スポーツ':     { gradient: 'from-green-500/20 to-emerald-600/20', glowColor: 'rgba(0,255,136,0.15)',   textClass: 'text-emerald-300' },
  'テクノロジー': { gradient: 'from-blue-500/20 to-indigo-600/20',   glowColor: 'rgba(59,130,246,0.15)',  textClass: 'text-blue-300' },
  'ビジネス':     { gradient: 'from-amber-500/20 to-yellow-600/20',  glowColor: 'rgba(255,170,0,0.15)',   textClass: 'text-amber-300' },
  '事件事故':     { gradient: 'from-orange-500/20 to-red-600/20',    glowColor: 'rgba(249,115,22,0.15)',  textClass: 'text-orange-300' },
  'ライフスタイル': { gradient: 'from-teal-500/20 to-cyan-600/20',   glowColor: 'rgba(20,184,166,0.15)',  textClass: 'text-teal-300' },
  'カルチャー':   { gradient: 'from-fuchsia-500/20 to-pink-600/20',  glowColor: 'rgba(217,70,239,0.15)',  textClass: 'text-fuchsia-300' },
};

// デフォルトのカテゴリスタイル
const DEFAULT_CATEGORY_STYLE = {
  gradient: 'from-slate-500/20 to-gray-600/20',
  glowColor: 'rgba(100,100,180,0.15)',
  textClass: 'text-slate-300',
};

interface FilterPanelProps {
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  batchMode: boolean;
  setBatchMode: (val: boolean) => void;
  batchCount: number;
  setBatchCount: (val: number) => void;
  batchDiversityMode: boolean;
  setBatchDiversityMode: (val: boolean) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** カテゴリ選択/解除トグル */
  onCategoryToggle: (category: string) => void;
  /** カテゴリ詳細モーダルを開くハンドラー */
  onOpenCategoryDetail: (category: string) => void;
  onSelectAllCategories: () => void;
  onDeselectAllCategories: () => void;
}

/** フィルター設定パネル（カテゴリ・尺・テンション・口調・バッチ設定） */
export default function FilterPanel({
  filters,
  setFilters,
  batchMode,
  setBatchMode,
  batchCount,
  setBatchCount,
  batchDiversityMode,
  setBatchDiversityMode,
  isFilterOpen,
  setIsFilterOpen,
  onCategoryToggle,
  onOpenCategoryDetail,
  onSelectAllCategories,
  onDeselectAllCategories,
}: FilterPanelProps) {
  // オーバーレイへの参照（スクロール位置リセット用）
  const filterOverlayRef = useRef<HTMLDivElement>(null);

  // フィルターオーバーレイ表示中はbodyスクロールをロック + スクロール位置リセット
  useEffect(() => {
    if (isFilterOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      requestAnimationFrame(() => {
        filterOverlayRef.current?.scrollTo(0, 0);
      });
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isFilterOpen]);

  // フィルターコンテンツ（Portal経由でフルスクリーンオーバーレイ表示）
  const filterOverlay = isFilterOpen && typeof document !== 'undefined' ? createPortal(
    <div
      ref={filterOverlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="フィルター設定"
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        backgroundColor: 'rgba(8, 8, 18, 0.98)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 animate-slide-up">
        {/* オーバーレイヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Settings size={18} className="text-[var(--color-text-muted)]" />
            フィルター設定
          </h2>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-full glass-card-light border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white transition-colors"
            aria-label="フィルターを閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* キーワード検索 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            キーワードで絞り込み
          </label>
          <input
            type="text"
            value={filters.keyword || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            placeholder="例: AI、円安、大谷翔平、地震..."
            className="w-full px-4 py-3 rounded-xl text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--color-border)',
            }}
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            空欄なら自動で最新の話題を取得します
          </p>
        </div>

        {/* カテゴリ選択ベントグリッド */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              カテゴリ
            </label>
            <div className="flex gap-2">
              <button
                onClick={onSelectAllCategories}
                className="text-xs px-3 py-1 rounded-lg glass-card-light text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-border-alt)] transition-all duration-200"
              >
                全選択
              </button>
              <button
                onClick={onDeselectAllCategories}
                className="text-xs px-3 py-1 rounded-lg glass-card-light text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-border-alt)] transition-all duration-200"
              >
                全解除
              </button>
            </div>
          </div>

          {/* 全カテゴリ表示中メッセージ */}
          {filters.categories.length === 0 && !batchMode && (
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              全カテゴリ対象 — カテゴリを選択してフィルタリングできます
            </p>
          )}
          {batchMode && (
            <p className="text-xs text-cyan-400 mb-3">
              バッチモード: 選択カテゴリから重複なしで{batchCount}件生成
            </p>
          )}

          {/* カテゴリグリッド（ベントスタイル） */}
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {categoryOptions.map((category) => {
              const hasDetail = !!(filters.categoryDetails?.[category.value]);
              const isSelected = filters.categories.includes(category.value);
              const style = CATEGORY_GRADIENTS[category.value] || DEFAULT_CATEGORY_STYLE;

              return (
                <button
                  key={category.value}
                  onClick={() => onCategoryToggle(category.value)}
                  aria-pressed={isSelected}
                  className={`relative py-3 px-3 min-h-[52px] rounded-xl border transition-all duration-200 touch-manipulation text-sm font-medium text-left overflow-hidden group ${
                    isSelected
                      ? `bg-gradient-to-br ${style.gradient} border-white/10 ${style.textClass} neon-glow-cyan`
                      : 'glass-card-light border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-cyan-500/30'
                  }`}
                  style={isSelected ? { boxShadow: `0 0 16px ${style.glowColor}` } : {}}
                >
                  {/* グレインオーバーレイ（選択時） */}
                  {isSelected && (
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
                        backgroundSize: '128px 128px',
                      }}
                    />
                  )}

                  <span className="relative flex items-center gap-1.5">
                    {category.value === '事件事故' && (
                      <AlertTriangle size={11} className="text-orange-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{category.label}</span>
                  </span>

                  {/* 選択済み: 詳細設定アイコン */}
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCategoryDetail(category.value);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded-md hover:bg-white/10 transition-colors"
                      aria-label={`${category.label}の詳細設定`}
                    >
                      <Settings size={11} className="text-white/50 hover:text-white/80" />
                    </button>
                  )}

                  {/* 詳細フィルター適用済みインジケーター */}
                  {hasDetail && !isSelected && (
                    <span className="absolute top-1.5 right-1.5">
                      <CheckCircle2 size={11} className="text-emerald-400" />
                    </span>
                  )}
                  {hasDetail && isSelected && (
                    <span className="absolute bottom-1 right-1.5">
                      <CheckCircle2 size={9} className="text-emerald-400" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            タップで選択/解除。選択後の歯車アイコンで期間・地域を詳細設定できます
          </p>
        </div>

        {/* バッチ生成設定パネル */}
        {batchMode && (
          <div className="mb-6 rounded-xl p-4 border border-purple-500/20"
            style={{ background: 'rgba(124,58,237,0.08)' }}>
            <h3 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <Sparkles size={14} />
              バッチ生成設定
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                  生成件数: <span className="text-white font-semibold">{batchCount}件</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="20"
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ background: 'var(--color-border-alt)' }}
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                  <span>10件</span>
                  <span>20件</span>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-3 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchDiversityMode}
                    onChange={(e) => setBatchDiversityMode(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--color-border)] focus:ring-purple-500 focus:ring-2 cursor-pointer"
                    style={{ accentColor: '#7c3aed' }}
                  />
                  <span>多様性モード（重複除去）</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 事件事故はカテゴリ選択で制御（専用チェックボックスは廃止） */}

        {/* 期間選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            期間
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'today', label: '今日' },
              { value: 'week', label: '今週' },
              { value: 'month', label: '今月' },
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => setFilters(prev => ({ ...prev, timePeriod: option.value }))}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                  filters.timePeriod === option.value
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                    : 'glass-card-light border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-alt)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 詳細設定グリッド（尺・テンション・口調） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 尺選択 */}
          <div>
            <label className="block text-xs font-medium mb-2 text-[var(--color-text-secondary)] uppercase tracking-wider">
              尺
            </label>
            <select
              value={filters.duration}
              onChange={(e) => setFilters(prev => ({ ...prev, duration: Number(e.target.value) as 15 | 60 | 180 }))}
              className="w-full py-2.5 px-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 appearance-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--color-border)',
              }}
            >
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value} style={{ background: '#1a1a28' }}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* テンション選択 */}
          <div>
            <label className="block text-xs font-medium mb-2 text-[var(--color-text-secondary)] uppercase tracking-wider">
              テンション
            </label>
            <select
              value={filters.tension}
              onChange={(e) => setFilters(prev => ({ ...prev, tension: e.target.value as 'low' | 'medium' | 'high' }))}
              className="w-full py-2.5 px-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 appearance-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--color-border)',
              }}
            >
              {tensionOptions.map((option) => (
                <option key={option.value} value={option.value} style={{ background: '#1a1a28' }}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 口調選択 */}
          <div>
            <label className="block text-xs font-medium mb-2 text-[var(--color-text-secondary)] uppercase tracking-wider">
              口調プリセット
            </label>
            <select
              value={filters.tone}
              onChange={(e) => setFilters(prev => ({ ...prev, tone: e.target.value }))}
              className="w-full py-2.5 px-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 appearance-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--color-border)',
              }}
            >
              {tonePresets.map((preset) => (
                <option key={preset} value={preset} style={{ background: '#1a1a28' }}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 適用ボタン */}
        <div className="neon-divider my-4" />
        <button
          onClick={() => setIsFilterOpen(false)}
          className="w-full mt-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
            boxShadow: '0 0 24px rgba(124,58,237,0.3)',
          }}
        >
          この条件で決定
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* モード切替セグメントコントロール */}
      <div className="mb-5 md:mb-7">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
          {/* 通常モード */}
          <button
            onClick={() => setBatchMode(false)}
            className={`relative flex items-start gap-3 p-3 md:p-4 rounded-xl transition-all duration-200 text-left ${
              !batchMode
                ? 'text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
            style={!batchMode ? {
              background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,102,255,0.08))',
              border: '1px solid rgba(0,212,255,0.3)',
              boxShadow: '0 0 20px rgba(0,212,255,0.1)',
            } : {
              background: 'transparent',
              border: '1px solid transparent',
            }}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
              !batchMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-[var(--color-text-muted)]'
            }`}>
              <Zap size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">通常モード</div>
              <p className={`text-xs mt-0.5 leading-relaxed ${!batchMode ? 'text-cyan-300/70' : 'text-[var(--color-text-muted)]'}`}>
                トレンドから即座に生成
              </p>
            </div>
          </button>

          {/* バッチモード */}
          <button
            onClick={() => setBatchMode(true)}
            className={`relative flex items-start gap-3 p-3 md:p-4 rounded-xl transition-all duration-200 text-left ${
              batchMode
                ? 'text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
            style={batchMode ? {
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(219,39,119,0.08))',
              border: '1px solid rgba(124,58,237,0.35)',
              boxShadow: '0 0 20px rgba(124,58,237,0.12)',
            } : {
              background: 'transparent',
              border: '1px solid transparent',
            }}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
              batchMode ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-[var(--color-text-muted)]'
            }`}>
              <Layers size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                バッチモード
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">PRO</span>
              </div>
              <p className={`text-xs mt-0.5 leading-relaxed ${batchMode ? 'text-purple-300/70' : 'text-[var(--color-text-muted)]'}`}>
                全カテゴリから一括生成
              </p>
            </div>
          </button>
        </div>

        {/* フィルター設定ボタン */}
        <button
          className="flex items-center gap-2 mt-4 text-sm text-[var(--color-text-secondary)] hover:text-white cursor-pointer focus:outline-none transition-colors"
          onClick={() => setIsFilterOpen(prev => !prev)}
          aria-expanded={isFilterOpen}
          aria-label="フィルター設定を開閉する"
        >
          <Settings size={15} className="text-[var(--color-text-muted)]" />
          カテゴリ・尺・口調を設定
          <span className="text-[var(--color-text-muted)]">
            {isFilterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
      </div>

      {/* フィルターオーバーレイ（Portal経由） */}
      {filterOverlay}
    </>
  );
}
