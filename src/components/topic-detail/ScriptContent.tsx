'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, ChevronRight, Zap } from 'lucide-react';
import ScriptSection from './ScriptSection';
import { EditableScriptContent } from './types';

interface ScriptContentProps {
  category: string;
  displayContent: EditableScriptContent;
  copySuccess: string | null;
  isEditMode: boolean;
  onCopy: (text: string, key: string) => void;
  onUpdateField: (field: keyof EditableScriptContent, value: string) => void;
  onUpdateViewerQuestion: (index: number, value: string) => void;
  onUpdateExpansion: (index: number, value: string) => void;
  /** 展開トピック選択時のコールバック（台本チェーン用） */
  onSelectExpansion?: (text: string) => void;
  /** チェーン生成中フラグ */
  chainLoading?: boolean;
}

/** 台本本文コンテンツ（事件事故 / 通常トピックの出し分けを含む） */
export default function ScriptContent({
  category,
  displayContent,
  copySuccess,
  isEditMode,
  onCopy,
  onUpdateField,
  onUpdateViewerQuestion,
  onUpdateExpansion,
  onSelectExpansion,
  chainLoading,
}: ScriptContentProps) {
  // アニメーション：初回表示時のみ再生（100ms後にトリガー）
  const [hasAnimated, setHasAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (category === '事件事故') {
    return (
      <div className="space-y-5">
        <ScriptSection
          title="事実報告"
          content={displayContent.factualReport}
          colorClass="red"
          onCopy={() => onCopy(displayContent.factualReport, 'factualReport')}
          copySuccess={copySuccess === 'factualReport'}
          isEditMode={isEditMode}
          onEdit={(val) => onUpdateField('factualReport', val)}
          animIndex={0}
          hasAnimated={hasAnimated}
        />
        <ScriptSection
          title="状況説明"
          content={displayContent.seriousContext}
          colorClass="orange"
          onCopy={() => onCopy(displayContent.seriousContext, 'seriousContext')}
          copySuccess={copySuccess === 'seriousContext'}
          isEditMode={isEditMode}
          onEdit={(val) => onUpdateField('seriousContext', val)}
          animIndex={1}
          hasAnimated={hasAnimated}
        />
        <ScriptSection
          title="注意事項"
          content={displayContent.avoidanceNotes}
          colorClass="yellow"
          onCopy={() => onCopy(displayContent.avoidanceNotes, 'avoidanceNotes')}
          copySuccess={copySuccess === 'avoidanceNotes'}
          isEditMode={isEditMode}
          onEdit={(val) => onUpdateField('avoidanceNotes', val)}
          animIndex={2}
          hasAnimated={hasAnimated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ScriptSection
        title="つかみ"
        content={displayContent.opening}
        colorClass="blue"
        onCopy={() => onCopy(displayContent.opening, 'opening')}
        copySuccess={copySuccess === 'opening'}
        isEditMode={isEditMode}
        onEdit={(val) => onUpdateField('opening', val)}
        animIndex={0}
        hasAnimated={hasAnimated}
      />

      <ScriptSection
        title="ざっくり説明"
        content={displayContent.explanation}
        colorClass="blue"
        onCopy={() => onCopy(displayContent.explanation, 'explanation')}
        copySuccess={copySuccess === 'explanation'}
        isEditMode={isEditMode}
        onEdit={(val) => onUpdateField('explanation', val)}
        animIndex={1}
        hasAnimated={hasAnimated}
      />

      <ScriptSection
        title="配信者コメント"
        content={displayContent.streamerComment}
        colorClass="blue"
        onCopy={() => onCopy(displayContent.streamerComment, 'comment')}
        copySuccess={copySuccess === 'comment'}
        isEditMode={isEditMode}
        onEdit={(val) => onUpdateField('streamerComment', val)}
        animIndex={2}
        hasAnimated={hasAnimated}
      />

      {/* 視聴者参加質問セクション */}
      {displayContent.viewerQuestions.length > 0 && (
        <div
          className="relative rounded-xl p-5 overflow-hidden"
          style={{
            background: 'rgba(168,85,247,0.06)',
            border: '1px solid rgba(168,85,247,0.25)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-1 h-4 rounded"
                style={{ background: 'linear-gradient(180deg, #a855f7, #7c3aed)' }}
              />
              <h3
                className={`font-mono font-semibold text-xs tracking-widest uppercase transition-all ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}
                style={{ color: 'rgba(34,211,238,0.7)', animationDelay: '450ms', animationFillMode: 'forwards' }}
              >
                視聴者参加質問
              </h3>
            </div>
            <button
              onClick={() => onCopy(displayContent.viewerQuestions.join('\n'), 'questions')}
              aria-label="視聴者参加質問をコピー"
              className="flex items-center gap-1.5 text-purple-300 hover:text-white transition-colors duration-200 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              {copySuccess === 'questions' ? (
                <Check size={13} className="copy-success-icon text-green-400" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copySuccess === 'questions' ? 'コピー済' : 'コピー'}</span>
            </button>
          </div>
          {isEditMode ? (
            <div className="space-y-2">
              {displayContent.viewerQuestions.map((q, i) => (
                <textarea
                  key={i}
                  value={q}
                  onChange={(e) => onUpdateViewerQuestion(i, e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={2}
                />
              ))}
            </div>
          ) : (
            <ul className="text-gray-200 leading-relaxed space-y-2">
              {displayContent.viewerQuestions.map((question, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-2 text-sm font-mono ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}
                  style={{ animationDelay: `${510 + index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  {question}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 次の展開を選ぶ（チェーン生成） */}
      {displayContent.expansions.length > 0 && (
        <div
          className="relative rounded-xl p-5 overflow-hidden"
          style={{
            background: 'rgba(0,212,255,0.03)',
            border: '1px solid rgba(0,212,255,0.2)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-1 h-4 rounded"
                style={{ background: 'linear-gradient(180deg, #00d4ff, #7c3aed)' }}
              />
              <h3
                className={`font-mono font-semibold text-xs tracking-widest uppercase transition-all ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}
                style={{ color: 'rgba(34,211,238,0.7)', animationDelay: '600ms', animationFillMode: 'forwards' }}
              >
                {onSelectExpansion ? '次の話題を選ぶ' : '広げ方（3方向）'}
              </h3>
            </div>
            <button
              onClick={() => onCopy(displayContent.expansions.join('\n'), 'expansions')}
              aria-label="広げ方をコピー"
              className="flex items-center gap-1.5 text-cyan-300 hover:text-white transition-colors duration-200 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
            >
              {copySuccess === 'expansions' ? (
                <Check size={13} className="copy-success-icon text-green-400" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copySuccess === 'expansions' ? 'コピー済' : 'コピー'}</span>
            </button>
          </div>
          {isEditMode ? (
            <div className="space-y-2">
              {displayContent.expansions.map((e, i) => (
                <textarea
                  key={i}
                  value={e}
                  onChange={(ev) => onUpdateExpansion(i, ev.target.value)}
                  className="w-full px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  rows={2}
                />
              ))}
            </div>
          ) : onSelectExpansion ? (
            <div className="space-y-2">
              {displayContent.expansions.map((expansion, index) => (
                <button
                  key={index}
                  onClick={() => onSelectExpansion(expansion)}
                  disabled={chainLoading}
                  className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl glass-card-light border border-cyan-500/20 hover:border-cyan-400/50 hover:neon-glow-cyan transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed hologram-appear ${hasAnimated ? '' : 'opacity-0'}`}
                  style={{ animationDelay: `${660 + index * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs flex items-center justify-center font-mono border border-cyan-500/20 group-hover:bg-cyan-500/25 transition-colors">
                    <Zap size={14} />
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-white flex-1 font-mono leading-relaxed transition-colors">
                    {expansion}
                  </span>
                  <ChevronRight size={16} className="text-cyan-500/30 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
              {chainLoading && (
                <div className="text-center py-2 font-mono text-xs text-cyan-400/50 animate-pulse tracking-widest">
                  LOADING NEXT TOPIC...
                </div>
              )}
            </div>
          ) : (
            <ul className="text-gray-200 leading-relaxed space-y-2">
              {displayContent.expansions.map((expansion, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-2 text-sm font-mono ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}
                  style={{ animationDelay: `${660 + index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  {expansion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ScriptSection
        title="次の話題への繋ぎ"
        content={displayContent.transition}
        colorClass="blue"
        onCopy={() => onCopy(displayContent.transition, 'transition')}
        copySuccess={copySuccess === 'transition'}
        isEditMode={isEditMode}
        onEdit={(val) => onUpdateField('transition', val)}
        animIndex={3}
        hasAnimated={hasAnimated}
      />
    </div>
  );
}
