// topic-detail コンポーネント群で共用する型定義

/** 編集可能な台本コンテンツの型 */
export interface EditableScriptContent {
  opening: string;
  explanation: string;
  streamerComment: string;
  viewerQuestions: string[];
  expansions: string[];
  transition: string;
  // 事件事故用フィールド
  factualReport: string;
  seriousContext: string;
  avoidanceNotes: string;
}
