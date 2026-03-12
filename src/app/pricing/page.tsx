'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  X,
  Zap,
  ChevronDown,
  ChevronUp,
  Star,
  Shield,
  Cpu,
  BarChart2,
  Monitor,
  Radio,
} from 'lucide-react';

// Proプランの機能リスト
const FREE_FEATURES = [
  { label: '1日3回生成',          available: true },
  { label: '基本カテゴリ（3種）',  available: true },
  { label: '台本コピー',           available: true },
  { label: 'テレプロンプター',     available: false },
  { label: 'OBS連携',             available: false },
  { label: 'スタイル学習',         available: false },
  { label: '分析ダッシュボード',   available: false },
];

const PRO_FEATURES = [
  { label: '1日100回生成',          available: true },
  { label: '全カテゴリ（6種）',     available: true },
  { label: '台本コピー',            available: true },
  { label: 'テレプロンプター',      available: true },
  { label: 'OBS連携',              available: true },
  { label: 'スタイル学習',          available: true },
  { label: '分析ダッシュボード',    available: true },
  { label: '優先API処理',          available: true },
];

// FAQ定義
const FAQ_ITEMS = [
  {
    question: 'いつでも解約できますか？',
    answer:
      'はい、いつでもキャンセル可能です。解約後も請求期間の終了まで Pro 機能をご利用いただけます。',
  },
  {
    question: '無料プランから途中でアップグレードできますか？',
    answer:
      'もちろんです。設定ページまたはこのページのボタンからいつでもアップグレードできます。日割り計算で請求されます。',
  },
  {
    question: '支払い方法は何に対応していますか？',
    answer:
      'クレジットカード（Visa・Mastercard・JCB・American Express）に対応予定です。',
  },
  {
    question: '生成した台本の著作権はどうなりますか？',
    answer:
      '生成した台本はすべてご主人様に帰属します。商用配信・販売・二次利用も自由です。',
  },
];

// アコーディオン単体コンポーネント
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-white hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium text-sm">{question}</span>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-300 leading-relaxed border-t border-gray-700/50">
          <p className="pt-3">{answer}</p>
        </div>
      )}
    </div>
  );
}

// 機能行コンポーネント
function FeatureRow({ label, available }: { label: string; available: boolean }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {available ? (
        <Check size={16} className="text-green-400 flex-shrink-0" />
      ) : (
        <X size={16} className="text-gray-600 flex-shrink-0" />
      )}
      <span className={available ? 'text-gray-200' : 'text-gray-500'}>
        {label}
      </span>
    </li>
  );
}

export default function PricingPage() {
  // Proボタンのアラート
  const handleProClick = () => {
    alert('近日公開予定です。楽しみにお待ちください。');
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
      {/* ページヘッダー */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          料金プラン
        </h1>
        <p className="text-gray-400 text-lg">
          あなたの配信を次のレベルへ
        </p>
      </div>

      {/* プランカードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">

        {/* Freeプランカード */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-8 flex flex-col">
          {/* プランヘッダー */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-gray-400" />
              <span className="text-lg font-semibold text-gray-300">Free</span>
            </div>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-white">¥0</span>
              <span className="text-gray-400 mb-1">/月</span>
            </div>
            <p className="text-sm text-gray-500">クレジットカード不要</p>
          </div>

          {/* 機能リスト */}
          <ul className="space-y-3 flex-1 mb-8">
            {FREE_FEATURES.map(f => (
              <FeatureRow key={f.label} label={f.label} available={f.available} />
            ))}
          </ul>

          {/* CTA */}
          <Link
            href="/"
            className="block text-center py-3 px-6 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-700/50 transition-colors text-sm font-medium"
          >
            現在のプラン
          </Link>
        </div>

        {/* Proプランカード */}
        <div className="relative bg-gradient-to-b from-blue-900/40 to-purple-900/40 border border-blue-500/50 rounded-2xl p-8 flex flex-col shadow-[0_0_40px_rgba(59,130,246,0.15)]">
          {/* おすすめバッジ */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold px-4 py-1 rounded-full flex items-center gap-1">
              <Star size={11} />
              おすすめ
            </span>
          </div>

          {/* プランヘッダー */}
          <div className="mb-6 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-blue-400" />
              <span className="text-lg font-semibold text-white">Pro</span>
            </div>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-white">¥980</span>
              <span className="text-gray-300 mb-1">/月</span>
            </div>
            <p className="text-sm text-blue-300/70">いつでも解約可能</p>
          </div>

          {/* 機能リスト */}
          <ul className="space-y-3 flex-1 mb-8">
            {PRO_FEATURES.map(f => (
              <FeatureRow key={f.label} label={f.label} available={f.available} />
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={handleProClick}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.99]"
          >
            Pro にアップグレード
          </button>
        </div>
      </div>

      {/* 特徴ハイライト */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {[
          { icon: Shield,   label: 'セキュア',     desc: 'データ暗号化対応' },
          { icon: Cpu,      label: 'AI最適化',     desc: 'GPT-4o 搭載' },
          { icon: Monitor,  label: 'テレプロンプター', desc: 'OBS連携対応' },
          { icon: BarChart2, label: '分析機能',    desc: '配信データを可視化' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 text-center">
            <Icon size={22} className="text-blue-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-gray-500 mt-1">{desc}</p>
          </div>
        ))}
      </div>

      {/* よくある質問 */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6 text-center">よくある質問</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map(item => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>

      {/* 下部CTA */}
      <div className="text-center bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-2xl p-8">
        <Radio size={32} className="text-blue-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">
          配信をもっと楽しく、もっと簡単に
        </h3>
        <p className="text-gray-400 text-sm mb-5">
          TalkGen Pro で、毎回のネタ探しから解放されましょう。
        </p>
        <button
          onClick={handleProClick}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-105"
        >
          <Zap size={18} />
          Pro プランを試す
        </button>
        <p className="text-xs text-gray-500 mt-3">近日公開予定</p>
      </div>
    </div>
  );
}
