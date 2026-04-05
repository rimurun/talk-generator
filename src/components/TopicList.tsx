'use client';

import { useState } from 'react';
import { Topic, FilterOptions } from '@/types';
import TopicCard from './TopicCard';
import TopicDetail from './TopicDetail';

interface TopicListProps {
  topics: Topic[];
  filters: FilterOptions;
  onTopicSelect?: () => void;
  onBackToList?: () => void;
}

export default function TopicList({ topics, filters, onTopicSelect, onBackToList }: TopicListProps) {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  // テレプロンプター直起動フラグ（TopicCard から起動した場合に true）
  const [launchTeleprompter, setLaunchTeleprompter] = useState(false);

  const handleTopicSelect = (topic: Topic) => {
    setLaunchTeleprompter(false);
    setSelectedTopic(topic);
    onTopicSelect?.();
  };

  // TopicCard のテレプロンプターアイコンから起動
  const handleTeleprompterLaunch = (topic: Topic) => {
    setLaunchTeleprompter(true);
    setSelectedTopic(topic);
    onTopicSelect?.();
  };

  const handleBackToList = () => {
    setSelectedTopic(null);
    setLaunchTeleprompter(false);
    onBackToList?.();
  };

  if (selectedTopic) {
    return (
      <TopicDetail
        topic={selectedTopic}
        filters={filters}
        onBack={handleBackToList}
        autoTeleprompter={launchTeleprompter}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">
          生成されたトピック ({topics.length}件)
        </h2>
        <div className="flex items-center gap-1.5 text-sm font-medium text-purple-300">
          <span>台本を見るにはカードをクリック</span>
          <span className="text-base">→</span>
        </div>
      </div>
      
      {topics.length === 0 ? (
        // 空状態の表示
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">
            トピックがありません
          </h3>
          <p className="text-gray-400 mb-6">
            上記の設定でトピックを生成してください。<br />
            フィルター条件を調整すると、より多くのトピックが見つかる可能性があります。
          </p>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="text-sm font-semibold text-gray-200 mb-2">💡 ヒント</h4>
            <ul className="text-sm text-gray-400 text-left space-y-1">
              <li>• カテゴリを全選択してみる</li>
              <li>• 事件事故を含める設定にする</li>
              <li>• テンションを変更してみる</li>
            </ul>
          </div>
        </div>
      ) : (
        // 通常の表示
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((topic, index) => (
            <div
              key={topic.id}
              className={`animate-stagger stagger-${Math.min(index + 1, 6)} opacity-0`}
            >
              <TopicCard
                topic={topic}
                onClick={() => handleTopicSelect(topic)}
                onTeleprompter={() => handleTeleprompterLaunch(topic)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}