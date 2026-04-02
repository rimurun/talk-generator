'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Wifi } from 'lucide-react';

interface ApiStatusIndicatorProps {
  className?: string;
}

interface ApiStatus {
  perplexity: boolean;
  openai: boolean;
  gnews: boolean;
  xApi: boolean;
}

export default function ApiStatusIndicator({ className = '' }: ApiStatusIndicatorProps) {
  const [status, setStatus] = useState<ApiStatus | null>(null);

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        setStatus({
          perplexity: data.perplexityEnabled || false,
          openai: data.openaiEnabled || false,
          gnews: data.gnewsEnabled || false,
          xApi: data.xApiEnabled || false,
        });
      } catch (error) {
        console.error('API状態チェック失敗:', error);
        setStatus({ perplexity: false, openai: false, gnews: false, xApi: false });
      }
    };

    checkApiStatus();
  }, []);

  if (!status) return null;

  const apis = [
    { name: 'Perplexity Sonar', enabled: status.perplexity, role: 'トピック生成' },
    { name: 'OpenAI', enabled: status.openai, role: '台本生成' },
    { name: 'GNews', enabled: status.gnews, role: 'ニュース' },
    { name: 'X API', enabled: status.xApi, role: 'SNSトレンド' },
  ];

  const allEnabled = apis.every(a => a.enabled);
  const enabledCount = apis.filter(a => a.enabled).length;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {apis.map((api) => (
        <div
          key={api.name}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
            api.enabled
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-gray-500/10 border-gray-500/20 text-gray-500'
          }`}
          title={`${api.name} — ${api.role}${api.enabled ? '（接続中）' : '（未設定）'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${api.enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
          {api.name}
        </div>
      ))}
    </div>
  );
}
