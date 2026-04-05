'use client';

import { useState, useEffect } from 'react';
import { Zap, LayoutGrid, FileText, Bookmark, X } from 'lucide-react';

// オンボーディング完了フラグのlocalStorageキー
const ONBOARDING_KEY = 'talkgen_onboarding_complete';

// ステップ定義（初回ユーザー向けに3ステップに絞る）
const STEPS = [
  {
    icon: Zap,
    title: 'ようこそ TalkGen へ！',
    description:
      'TalkGen は配信者向けのAI台本生成ツールです。最新トレンドを自動で収集し、そのまま読めるトーク台本に変換します。',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  {
    icon: LayoutGrid,
    title: 'カテゴリを選んで台本を生成',
    description:
      'ニュース・エンタメ・SNS・TikTokなど、話したいジャンルを選択します。「トーク台本を生成」ボタンを押すとAIが最新情報をWeb検索し、配信でそのまま読めるスクリプトを自動作成します。',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  {
    icon: Bookmark,
    title: 'お気に入り・履歴で管理',
    description:
      '生成した台本はお気に入り登録でいつでも呼び出せます。履歴から過去の台本を確認・再利用することも可能です。',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
];

export default function OnboardingOverlay() {
  // サーバーサイドレンダリング時は表示しない
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMounted(true);
    // オンボーディング未完了のユーザーにのみ表示
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // 少し遅延してから表示（ページロード直後の表示を避ける）
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // オンボーディングを完了としてマーク
  const complete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShow(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(prev => prev + 1);
    } else {
      complete();
    }
  };

  const handleSkip = () => {
    complete();
  };

  // SSR対応: マウント前またはフラグがfalseなら何も表示しない
  if (!mounted || !show) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    // 背景オーバーレイ（クリックしても完了扱いにしない）
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      {/* ステップカード */}
      <div
        key={step}
        className={`relative bg-gray-800 border ${current.border} rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in`}
      >
        {/* スキップボタン（右上） */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="スキップ"
        >
          <X size={20} />
        </button>

        {/* アイコン */}
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${current.bg} mb-5`}>
          <Icon size={28} className={current.color} />
        </div>

        {/* タイトル */}
        <h2 className="text-xl font-bold text-white mb-3">
          {current.title}
        </h2>

        {/* 説明文 */}
        <p className="text-gray-300 text-sm leading-relaxed mb-8">
          {current.description}
        </p>

        {/* プログレスドット + ボタン */}
        <div className="flex items-center justify-between">
          {/* プログレスドット */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === step
                    ? `w-4 ${current.color.replace('text-', 'bg-')}`
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                aria-label={`ステップ${i + 1}へ`}
              />
            ))}
            <span className="text-xs text-gray-500 ml-1">
              {step + 1}/{STEPS.length}
            </span>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
            >
              スキップ
            </button>
            <button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {isLast ? '始める' : '次へ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
