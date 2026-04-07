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
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all duration-300 ${
            api.enabled ? 'neon-pulse-border' : ''
          }`}
          style={{
            background: api.enabled ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
            color: api.enabled ? '#00d4ff' : 'rgba(255,255,255,0.2)',
            border: `1px solid ${api.enabled ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
            boxShadow: api.enabled ? '0 0 8px rgba(0,212,255,0.3), inset 0 0 8px rgba(0,212,255,0.05)' : 'none',
            textShadow: api.enabled ? '0 0 6px rgba(0,212,255,0.5)' : 'none',
          }}
          title={`${api.name} — ${api.role}${api.enabled ? '（接続中）' : '（未設定）'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${api.enabled ? 'animate-pulse' : ''}`}
            style={{ background: api.enabled ? '#00d4ff' : 'rgba(255,255,255,0.15)', boxShadow: api.enabled ? '0 0 4px #00d4ff' : 'none' }}
          />
          {api.name}
        </div>
      ))}
    </div>
  );
}
