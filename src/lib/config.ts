// アプリケーション設定定数

// API設定
export const API_CONFIG = {
  // レート制限
  RATE_LIMIT: {
    COOLDOWN_MS: 2000, // 2秒のクールダウン
    REQUEST_TIMEOUT_MS: 30000, // 30秒のタイムアウト
    RETRY_ATTEMPTS: 3, // 最大リトライ回数
  },
  
  // OpenAI API設定
  OPENAI: {
    MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
    MAX_TOKENS: {
      TOPICS: 4000,
      SCRIPT: 2000,
    },
    TEMPERATURE: {
      TOPICS: 0.7,
      SCRIPT: 0.8,
    },
    TIMEOUT: 30000, // 30秒
  },
  
  // エンドポイント
  ENDPOINTS: {
    TOPICS: '/api/topics',
    SCRIPT: '/api/script',
    USAGE: '/api/usage',
  }
} as const;

// UI設定
export const UI_CONFIG = {
  // アニメーション
  ANIMATIONS: {
    STAGGER_DELAY_MS: 100, // スタガーアニメーションの遅延
    TRANSITION_DURATION_MS: 300, // 基本的なトランジション時間
    FADE_DURATION_MS: 500, // フェードアニメーション時間
    COPY_FEEDBACK_DURATION_MS: 2000, // コピー完了表示時間
  },
  
  // レイアウト
  LAYOUT: {
    MAX_TOPICS_PER_REQUEST: 15, // 1回のリクエストでの最大トピック数
    SKELETON_CARDS_COUNT: 6, // スケルトンUI表示カード数
    GRID_BREAKPOINTS: {
      MD: 'md:grid-cols-2', // タブレット
      LG: 'lg:grid-cols-3', // デスクトップ
    }
  },
  
  // フォーム
  FORM: {
    DEBOUNCE_MS: 300, // フォーム入力のデバウンス時間
    MIN_CATEGORY_SELECTION: 0, // 最小カテゴリ選択数
    DEFAULT_VALUES: {
      DURATION: 60 as const, // デフォルト尺（秒）
      TENSION: 'medium' as const, // デフォルトテンション
      TONE: 'フレンドリー' as const, // デフォルト口調
      INCLUDE_INCIDENTS: false, // 事件事故を含めるか
    }
  }
} as const;

// トピック設定
export const TOPIC_CONFIG = {
  // カテゴリ設定
  CATEGORIES: {
    NEWS: 'ニュース',
    ENTERTAINMENT: 'エンタメ',
    SNS: 'SNS',
    TIKTOK: 'TikTok',
    FOREIGN_FUNNY: '海外おもしろ',
    INCIDENT: '事件事故',
  },
  
  // リスクレベル
  RISK_LEVELS: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  },
  
  // センシティブ度（1-3）
  SENSITIVITY_LEVELS: {
    MIN: 1,
    MAX: 3,
  },
  
  // 尺オプション（秒）
  DURATIONS: [15, 60, 180] as const,
  
  // テンションオプション
  TENSIONS: ['low', 'medium', 'high'] as const,
} as const;

// セキュリティ設定
export const SECURITY_CONFIG = {
  // CSP設定
  CSP: {
    DEFAULT_SRC: "'self'",
    SCRIPT_SRC: "'self' 'unsafe-eval' 'unsafe-inline'",
    STYLE_SRC: "'self' 'unsafe-inline'",
    IMG_SRC: "'self' data: blob: https:",
    CONNECT_SRC: "'self' https://api.openai.com",
  },
  
  // 外部リンク設定
  EXTERNAL_LINK: {
    TARGET: '_blank',
    REL: 'noopener noreferrer',
  }
} as const;

// PWA設定
export const PWA_CONFIG = {
  APP_NAME: 'トーク生成ツール',
  SHORT_NAME: 'TalkGen',
  THEME_COLOR: '#1f2937',
  BACKGROUND_COLOR: '#000000',
  DISPLAY: 'standalone',
  ORIENTATION: 'portrait-primary',
} as const;

// 開発設定
export const DEV_CONFIG = {
  // ログレベル
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  
  // デバッグ設定
  ENABLE_DEBUG: process.env.NODE_ENV === 'development',
  
  // API設定
  USE_PRODUCTION_API: process.env.OPENAI_API_KEY ? true : false, // OpenAI API使用可否
  FALLBACK_TO_MOCK: true, // API失敗時にモックデータを使用
} as const;

// タイプエクスポート（型安全性のため）
export type Duration = typeof TOPIC_CONFIG.DURATIONS[number];
export type Tension = typeof TOPIC_CONFIG.TENSIONS[number];
export type RiskLevel = keyof typeof TOPIC_CONFIG.RISK_LEVELS;
export type Category = keyof typeof TOPIC_CONFIG.CATEGORIES;