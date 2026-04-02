'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangleIcon, RefreshIcon } from './icons';
import { trackError } from '@/lib/error-tracking';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラーをトラッキングシステムに記録（LocalStorage + コンソール出力）
    // 将来的にSentry等の外部サービスへの送信もここで行う
    trackError(error, 'error', {
      componentStack: errorInfo.componentStack,
      source: 'ErrorBoundary',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // カスタムフォールバックUIがあれば使用
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのエラーUI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="flex justify-center mb-6">
              <div className="bg-red-500/20 p-4 rounded-full">
                <AlertTriangleIcon size={48} className="text-red-400" />
              </div>
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-4">
              申し訳ありません
            </h2>
            
            <p className="text-gray-300 mb-6 leading-relaxed">
              予期しないエラーが発生しました。しばらく待ってからもう一度お試しいただくか、
              問題が続く場合はページを再読み込みしてください。
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <summary className="text-red-300 font-medium cursor-pointer mb-2">
                  エラー詳細（開発者向け）
                </summary>
                <pre className="text-red-200 text-sm overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <RefreshIcon size={18} />
                <span>再試行</span>
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 hover:bg-gray-500 text-gray-200 px-6 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
              >
                ページ再読み込み
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}