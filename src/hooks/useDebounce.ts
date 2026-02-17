import { useState, useEffect, useRef } from 'react';
import { API_CONFIG } from '@/lib/config';

/**
 * カスタムデバウンスフック
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * API呼び出し用クールダウンフック
 */
export function useCooldown(cooldownMs: number = API_CONFIG.RATE_LIMIT.COOLDOWN_MS) {
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = () => {
    setIsOnCooldown(true);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsOnCooldown(false);
      timeoutRef.current = null;
    }, cooldownMs);
  };

  const resetCooldown = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOnCooldown(false);
  };

  return {
    isOnCooldown,
    startCooldown,
    resetCooldown
  };
}