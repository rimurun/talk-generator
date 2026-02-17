'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';

interface ApiStatusIndicatorProps {
  className?: string;
}

export default function ApiStatusIndicator({ className = '' }: ApiStatusIndicatorProps) {
  const [isOpenAIEnabled, setIsOpenAIEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if OpenAI API is configured by making a request to a status endpoint
    const checkApiStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        setIsOpenAIEnabled(data.openaiEnabled || false);
      } catch (error) {
        console.error('Failed to check API status:', error);
        setIsOpenAIEnabled(false);
      }
    };

    checkApiStatus();
  }, []);

  if (isOpenAIEnabled === null) {
    return null; // Loading state
  }

  if (isOpenAIEnabled) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-sm text-green-700 dark:text-green-400 ${className}`}>
        <Wifi className="w-4 h-4" />
        <span className="font-medium">OpenAI API</span>
        <span className="text-xs opacity-75">接続中</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-sm text-amber-700 dark:text-amber-400 ${className}`}>
      <AlertTriangle className="w-4 h-4" />
      <span className="font-medium">モックデータ</span>
      <span className="text-xs opacity-75">表示中</span>
    </div>
  );
}