'use client';

import { Script } from '@/types';
import { durationOptions } from '@/lib/mock-data';
import {
  Copy, Pencil, Save, RotateCcw, Monitor, Share2, Heart,
  Check, Star
} from 'lucide-react';
import { CopyIcon } from '@/components/icons';

interface ScriptActionsProps {
  script: Script;
  currentDuration: 15 | 60 | 180;
  loading: boolean;
  isEditMode: boolean;
  copySuccess: string | null;
  showRatingForm: boolean;
  showExportPanel: boolean;
  currentRating: number;
  ratingComment: string;
  quickRating: number;
  quickRatingHover: number;
  /** 全文コピー用フォーマット済みテキスト */
  formattedScriptText: string;
  onDurationChange: (duration: 15 | 60 | 180) => void;
  onTeleprompter: () => void;
  onToggleEditMode: () => void;
  onSaveEdit: () => void;
  onResetEdit: () => void;
  onCopyFull: () => void;
  onToggleRatingForm: () => void;
  onToggleExportPanel: () => void;
  onRatingSubmit: () => void;
  onRatingCancel: () => void;
  onSetCurrentRating: (val: number) => void;
  onSetRatingComment: (val: string) => void;
  onQuickRating: (star: number) => void;
  onQuickRatingHover: (star: number) => void;
}

/** 台本ヘッダーのアクションバー（テレプロンプター・編集・評価・エクスポート・尺切替） */
export default function ScriptActions({
  script,
  currentDuration,
  loading,
  isEditMode,
  copySuccess,
  showRatingForm,
  showExportPanel,
  currentRating,
  ratingComment,
  quickRating,
  quickRatingHover,
  formattedScriptText,
  onDurationChange,
  onTeleprompter,
  onToggleEditMode,
  onSaveEdit,
  onResetEdit,
  onCopyFull,
  onToggleRatingForm,
  onToggleExportPanel,
  onRatingSubmit,
  onRatingCancel,
  onSetCurrentRating,
  onSetRatingComment,
  onQuickRating,
  onQuickRatingHover,
}: ScriptActionsProps) {
  return (
    <>
      {/* 台本ヘッダー（尺切替 + アクションボタン） */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          {/* セクションヘッダー（グラデーション下線付き） */}
          <div className="relative">
            <h2 className="text-2xl font-semibold text-white pb-1">配信用台本</h2>
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded"
              style={{ background: 'linear-gradient(90deg, #06b6d4, transparent)' }}
            />
          </div>

          {/* 尺切替ボタン */}
          <div className="flex items-center space-x-2">
            {durationOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onDurationChange(option.value as 15 | 60 | 180)}
                disabled={loading}
                aria-label={`台本の尺を${option.label}に変更`}
                aria-pressed={currentDuration === option.value}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  currentDuration === option.value
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-gray-700/60 text-gray-300 border border-gray-600 hover:bg-gray-600 focus:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 右側アクションボタン群 */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* テレプロンプターボタン（パルスグロー） */}
          <button
            onClick={onTeleprompter}
            aria-label="テレプロンプターで表示"
            className="teleprompter-btn flex items-center gap-2 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 text-sm"
            style={{
              background: 'linear-gradient(135deg, #0891b2, #2563eb)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            <Monitor size={16} />
            テレプロンプター
          </button>

          {/* 編集モードトグルボタン */}
          <button
            onClick={onToggleEditMode}
            aria-label={isEditMode ? '編集モードを終了' : '編集モードを開始'}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
              isEditMode
                ? 'bg-yellow-600/20 border border-yellow-500 text-yellow-300 hover:bg-yellow-600/30'
                : 'border border-gray-600/60 text-gray-300 hover:bg-gray-700/60'
            }`}
          >
            <Pencil size={15} />
            {isEditMode ? '編集中' : '編集'}
          </button>

          {/* 評価ボタン */}
          <button
            onClick={onToggleRatingForm}
            className="flex items-center gap-2 bg-purple-600/80 hover:bg-purple-600 text-white px-3 py-2 rounded-lg transition-all duration-200 text-sm"
          >
            <Heart size={15} />
            評価
          </button>

          {/* 簡易コピーボタン */}
          <button
            onClick={onCopyFull}
            aria-label="台本全体をクリップボードにコピー"
            className="flex items-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300/30 transition-all duration-200 text-sm border border-gray-600/40"
          >
            {copySuccess === 'full' ? (
              <Check size={14} className="copy-success-icon text-green-400" />
            ) : (
              <CopyIcon size={14} />
            )}
            <span>{copySuccess === 'full' ? 'コピー済' : 'コピー'}</span>
          </button>

          {/* エクスポートボタン */}
          <button
            onClick={onToggleExportPanel}
            aria-label="エクスポートパネルを開く"
            className="flex items-center gap-2 border border-gray-600/60 text-gray-300 hover:bg-gray-700/60 hover:text-white px-3 py-2 rounded-lg text-sm transition-all duration-200"
            style={{ animation: showExportPanel ? 'exportSlideIn 0.2s ease-out' : 'none' }}
          >
            <Share2 size={14} />
            エクスポート
          </button>
        </div>
      </div>

      {/* 編集モード時の保存・リセットバー */}
      {isEditMode && (
        <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-xl p-3 mb-6 flex items-center justify-between">
          <span className="text-sm text-yellow-300">
            編集モード: 各セクションのテキストを直接編集できます
          </span>
          <div className="flex gap-2">
            <button
              onClick={onSaveEdit}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              <Save size={14} />
              保存
            </button>
            <button
              onClick={onResetEdit}
              className="flex items-center gap-1.5 bg-gray-600 hover:bg-gray-500 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              <RotateCcw size={14} />
              リセット
            </button>
          </div>
        </div>
      )}

      {/* 保存成功フィードバック */}
      {copySuccess === 'saved' && (
        <div className="bg-green-900/20 border border-green-600/40 rounded-xl p-2 mb-4 text-center">
          <span className="text-green-400 text-sm">保存しました</span>
        </div>
      )}

      {/* 評価フォーム */}
      {showRatingForm && (
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-1 h-5 rounded"
              style={{ background: 'linear-gradient(180deg, #a855f7, #7c3aed)' }}
            />
            <h3 className="text-base font-semibold text-purple-200">台本を評価してください</h3>
          </div>

          {/* 星評価（ホバーグロー付き） */}
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onSetCurrentRating(star)}
                className="transition-all duration-150 hover:scale-110 rounded focus:outline-none"
                style={star <= currentRating ? { filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.7))' } : {}}
              >
                <Star
                  size={26}
                  className={star <= currentRating
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-600 hover:text-yellow-500/50'}
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-gray-300">
              {currentRating > 0 && `${currentRating}/5`}
            </span>
          </div>

          {/* コメント */}
          <textarea
            value={ratingComment}
            onChange={(e) => onSetRatingComment(e.target.value)}
            placeholder="コメント（任意）"
            className="w-full px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3 resize-none"
            rows={2}
          />

          {/* ボタン */}
          <div className="flex gap-2">
            <button
              onClick={onRatingSubmit}
              disabled={currentRating === 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              評価を保存
            </button>
            <button
              onClick={onRatingCancel}
              className="bg-gray-600/80 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 既存の評価表示 */}
      {currentRating > 0 && !showRatingForm && (
        <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-3 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-purple-300">あなたの評価:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  className={star <= currentRating ? 'text-yellow-400 fill-current' : 'text-gray-600'}
                  style={star <= currentRating ? { filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' } : {}}
                />
              ))}
            </div>
            {ratingComment && (
              <span className="text-gray-300">「{ratingComment}」</span>
            )}
          </div>
        </div>
      )}

      {/* クイック星評価ウィジェット（スタイル学習用） */}
      <div className="mt-8 pt-6 border-t border-gray-700/50">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">この台本を評価:</span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onQuickRating(star)}
                onMouseEnter={() => onQuickRatingHover(star)}
                onMouseLeave={() => onQuickRatingHover(0)}
                aria-label={`${star}星評価`}
                className="transition-all duration-150 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 rounded"
                style={
                  star <= (quickRatingHover || quickRating)
                    ? { filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.6))' }
                    : {}
                }
              >
                <Star
                  size={22}
                  className={
                    star <= (quickRatingHover || quickRating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-600'
                  }
                />
              </button>
            ))}
          </div>
          {quickRating > 0 && (
            <span className="text-xs text-gray-500">
              {quickRating}/5 — スタイル学習に反映されます
            </span>
          )}
        </div>
      </div>
    </>
  );
}
