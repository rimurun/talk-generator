export interface Topic {
  id: string;
  title: string;
  category: 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '事件事故';
  summary: string;
  sensitivityLevel: 1 | 2 | 3;
  riskLevel: 'low' | 'medium' | 'high';
  sourceUrl: string;
  createdAt: string;
}

export interface Script {
  id: string;
  topicId: string;
  duration: 15 | 60 | 180;
  tension: 'low' | 'medium' | 'high';
  tone: string;
  content: {
    opening?: string;
    explanation?: string;
    streamerComment?: string;
    viewerQuestions?: string[];
    expansions?: string[];
    transition?: string;
    // 事件事故用
    factualReport?: string;
    seriousContext?: string;
    avoidanceNotes?: string;
  };
}

export interface FilterOptions {
  categories: string[];
  includeIncidents: boolean;
  duration: 15 | 60 | 180;
  tension: 'low' | 'medium' | 'high';
  tone: string;
}

// API リクエスト・レスポンス型
export interface GenerateTopicsRequest {
  filters: FilterOptions;
}

export interface GenerateTopicsResponse {
  topics: Topic[];
  cost?: number;
  cached?: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
  timestamp?: string;
}

export interface GenerateScriptRequest {
  topic?: {
    id: string;
    title: string;
    category: 'ニュース' | 'エンタメ' | 'SNS' | 'TikTok' | '事件事故';
    summary: string;
    sensitivityLevel: 1 | 2 | 3;
    riskLevel: 'low' | 'medium' | 'high';
  };
  topicId?: string; // 後方互換性のため残す
  duration: 15 | 60 | 180;
  tension: 'low' | 'medium' | 'high';
  tone: string;
}

export interface GenerateScriptResponse {
  script: Script;
  cost?: number;
  cached?: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
  timestamp?: string;
}

// 使用量統計型
export interface UsageStats {
  tokensUsed: number;
  tokensLimit: number;
  tokensPercentage: number;
  requestsUsed: number;
  requestsLimit: number;
  requestsPercentage: number;
  estimatedCostToday: number;
  estimatedCostMonthly: number;
  cache: {
    hitRate: number;
    totalEntries: number;
    topicEntries: number;
    scriptEntries: number;
    batchEntries: number;
    totalHits: number;
    totalMisses: number;
  };
  alerts: {
    highUsage: boolean;
    veryHighUsage: boolean;
    message: string | null;
  };
  updatedAt: string;
}

// バッチ生成型
export interface BatchGenerationRequest {
  categories: string[];
  count: number; // 生成する件数
  diversityMode: boolean; // 重複回避
  filters: Omit<FilterOptions, 'categories'>;
}

export interface BatchGenerationResponse {
  topics: Topic[];
  totalCost: number;
  generationTime: number;
  categoryCoverage: Record<string, number>;
  cacheStats?: {
    cacheHits: number;
    totalRequests: number;
    cacheHitRate: number;
  };
  cached?: boolean;
  cacheHit?: boolean;
}

// 台本評価型
export interface ScriptRating {
  scriptId: string;
  topicId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  ratedAt: string;
}

// NGワード検出結果型
export interface NgWordDetection {
  detected: string[];
  hasViolation: boolean;
  suggestions?: string[];
}

// コンパクトモード設定型
export interface CompactModeSettings {
  enabled: boolean;
  fontSize: 'small' | 'medium' | 'large';
  showCategories: boolean;
  showRisk: boolean;
  autoSwipe: boolean;
}

// UI設定型
export interface UISettings {
  theme: 'dark' | 'light' | 'auto';
  compactMode: CompactModeSettings;
  notifications: boolean;
  soundEffects: boolean;
  animationsEnabled: boolean;
}