'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
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

      {/* 広げ方セクション */}
      {displayContent.expansions.length > 0 && (
        <div
          className="relative rounded-xl p-5 overflow-hidden"
          style={{
            background: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-1 h-4 rounded"
                style={{ background: 'linear-gradient(180deg, #22c55e, #16a34a)' }}
              />
              <h3
                className={`font-mono font-semibold text-xs tracking-widest uppercase transition-all ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}
                style={{ color: 'rgba(34,211,238,0.7)', animationDelay: '600ms', animationFillMode: 'forwards' }}
              >
                広げ方（3方向）
              </h3>
            </div>
            <button
              onClick={() => onCopy(displayContent.expansions.join('\n'), 'expansions')}
              aria-label="広げ方をコピー"
              className="flex items-center gap-1.5 text-green-300 hover:text-white transition-colors duration-200 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
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
                  className="w-full px-3 py-2 bg-gray-700/60 border border-gray-600/60 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  rows={2}
                />
              ))}
            </div>
          ) : (
            <ul className="text-gray-200 leading-relaxed space-y-2">
              {displayContent.expansions.map((expansion, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-2 text-sm font-mono ${hasAnimated ? 'animate-fade-in' : 'opacity-0'}`}
                  style={{ animationDelay: `${660 + index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-300 text-xs flex items-center justify-center mt-0.5">
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
