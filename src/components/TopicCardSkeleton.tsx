'use client';

export default function TopicCardSkeleton() {
  return (
    <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 animate-pulse">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-4">
        <div className="bg-gray-600/50 rounded-full h-6 w-20"></div>
        <div className="bg-gray-600/50 rounded h-4 w-4"></div>
      </div>

      {/* タイトル */}
      <div className="space-y-2 mb-3">
        <div className="bg-gray-600/50 rounded h-5 w-full"></div>
        <div className="bg-gray-600/50 rounded h-5 w-3/4"></div>
      </div>

      {/* 要約（3行） */}
      <div className="space-y-2 mb-4">
        <div className="bg-gray-600/50 rounded h-4 w-full"></div>
        <div className="bg-gray-600/50 rounded h-4 w-full"></div>
        <div className="bg-gray-600/50 rounded h-4 w-2/3"></div>
      </div>

      {/* メトリクス */}
      <div className="space-y-3">
        {/* センシティブ度 */}
        <div className="flex items-center justify-between">
          <div className="bg-gray-600/50 rounded h-3 w-20"></div>
          <div className="flex items-center space-x-1">
            <div className="bg-gray-600/50 rounded h-4 w-4"></div>
            <div className="bg-gray-600/50 rounded h-4 w-4"></div>
            <div className="bg-gray-600/50 rounded h-4 w-4"></div>
          </div>
        </div>

        {/* 炎上リスク */}
        <div className="flex items-center justify-between">
          <div className="bg-gray-600/50 rounded h-3 w-16"></div>
          <div className="bg-gray-600/50 rounded-full h-6 w-8"></div>
        </div>
      </div>

      {/* フッター */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="bg-gray-600/50 rounded h-3 w-24"></div>
          <div className="bg-gray-600/50 rounded h-3 w-20"></div>
        </div>
      </div>
    </div>
  );
}

interface TopicListSkeletonProps {
  count?: number;
}

export function TopicListSkeleton({ count = 6 }: TopicListSkeletonProps) {
  return (
    <div>
      {/* ヘッダー部分のスケルトン */}
      <div className="flex items-center justify-between mb-6">
        <div className="bg-gray-600/50 rounded h-8 w-48 animate-pulse"></div>
        <div className="bg-gray-600/50 rounded h-4 w-32 animate-pulse"></div>
      </div>
      
      {/* カードグリッドのスケルトン */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, index) => (
          <TopicCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}