export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        {/* メインスピナー */}
        <div className="w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
        
        {/* インナースピナー */}
        <div className="absolute top-2 left-2 w-12 h-12 border-3 border-gray-700 border-t-purple-500 rounded-full animate-spin animation-delay-150"></div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-lg font-medium text-gray-200 mb-2">
          AI が最新トピックを生成中...
        </p>
        <p className="text-sm text-gray-400">
          配信に最適なトーク台本を作成しています
        </p>
      </div>

      {/* 進行中のドット */}
      <div className="flex space-x-1 mt-4">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse animation-delay-200"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse animation-delay-400"></div>
      </div>

      <style jsx>{`
        .animation-delay-150 {
          animation-delay: 150ms;
        }
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  );
}