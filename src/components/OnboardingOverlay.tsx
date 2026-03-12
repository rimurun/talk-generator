'use client';

import { useState, useEffect } from 'react';
import { Zap, LayoutGrid, FileText, Monitor, Radio, X } from 'lucide-react';

// オンボーディング完了フラグのlocalStorageキー
const ONBOARDING_KEY = 'talkgen_onboarding_complete';

// ステップ定義
const STEPS = [
  {
    icon: Zap,
    title: 'ようこそ TalkGen へ！',
    description:
      'TalkGen は配信者向けのAI台本生成ツールです。最新トレンドを自動で収集し、そのまま読めるトーク台本に変換します。約1分で使い方を説明します。',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  {
    icon: LayoutGrid,
    title: 'カテゴリを選んで',
    description:
      'ニュース・エンタメ・SNS・TikTok・海外おもしろなど、話したいジャンルを選べます。カテゴリボタンをクリックすると、期間・地域・サブカテゴリを詳細設定できます。',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  {
    icon: FileText,
    title: '台本を生成',
    description:
      '「トーク台本を生成」ボタンを押すとAIが最新情報をWeb検索し、配信でそのまま読めるスクリプトを自動作成します。1日100回まで生成可能です。',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  {
    icon: Monitor,
    title: 'テレプロンプターで読む',
    description:
      '生成した台本は「テレプロンプター」モードで表示できます。スクロール速度を調整しながら、カメラを見たまま読み上げられます。配信中のカンペとして活用できます。',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
  {
    icon: Radio,
    title: 'OBSに連携',
    description:
      'OBS Studioのブラウザソースに登録すると、台本をオーバーレイとして配信画面に表示できます。視聴者には見えないレイヤーとして設定することも可能です。',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
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
    // 背景オーバーレイ
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={handleSkip}
    >
      {/* ステップカード（クリックイベントを止める） */}
      <div
        className={`relative bg-gray-800 border ${current.border} rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl`}
        onClick={e => e.stopPropagation()}
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
