import { useState, useEffect } from 'react';
import { Script, FilterOptions, GenerateScriptResponse } from '@/types';
import { API_CONFIG, UI_CONFIG } from '@/lib/config';
import { getAuthHeaders } from '@/lib/api-helpers';

interface UseScriptReturn {
  script: Script | null;
  loading: boolean;
  error: string | null;
  copySuccess: string | null;
  generateScript: (
    topicId: string, 
    duration: 15 | 60 | 180, 
    tension: 'low' | 'medium' | 'high', 
    tone: string
  ) => Promise<void>;
  copyToClipboard: (text: string, type: string) => Promise<void>;
  clearError: () => void;
}

export function useScript(): UseScriptReturn {
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const generateScript = async (
    topicId: string,
    duration: 15 | 60 | 180,
    tension: 'low' | 'medium' | 'high',
    tone: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(API_CONFIG.ENDPOINTS.SCRIPT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          topicId,
          duration,
          tension,
          tone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error(errorData.error || 'ゲストの利用回数上限に達しました。ログインしてご利用ください。');
        }
        throw new Error(errorData.error || 'サーバーエラーが発生しました');
      }

      const data: GenerateScriptResponse = await response.json();
      setScript(data.script);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : '台本生成中にエラーが発生しました。もう一度お試しください。';
      setError(errorMessage);
      console.error('Script generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), UI_CONFIG.ANIMATIONS.COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    script,
    loading,
    error,
    copySuccess,
    generateScript,
    copyToClipboard,
    clearError
  };
}