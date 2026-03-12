# 配信用リアルタイム・トーク生成ツール

配信者がボタン1つで最新ニュース・エンタメ・SNSトレンド・TikTok話題を取得し、配信でそのまま読めるトーク台本に自動変換するWebツール。

## 概要

OpenAI Responses API（`web_search_preview`ツール）でリアルタイムにトピックを収集し、Chat Completions APIで配信用台本を生成する。SupabaseをDBキャッシュ・お気に入り・履歴の永続ストアとして使用。Vercel（Hobbyプラン）にデプロイ済み。

## 主な機能

- **リアルタイムトピック収集**: Responses APIのweb検索でニュース・エンタメ・SNS・TikTokトレンドを自動収集
- **配信特化台本生成**: つかみ→説明→コメント→視聴者質問→次の話題への流れを自動生成
- **炎上リスク管理**: トピックごとにリスクレベル（low / medium / high）と炎上度（1-3段階）を表示
- **事件事故専用モード**: 煽らない・断定しない・事実ベースの安全なテンプレートを適用
- **カスタマイズ**: 尺（15秒/1分/3分）・テンション（低/中/高）・口調（6種類）を設定可能
- **お気に入り・履歴**: 生成したトピック・台本を保存・再利用
- **コスト追跡**: リクエストごとにAPI利用コストをリアルタイム表示

## 技術スタック

| カテゴリ | 内容 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| トピック生成API | OpenAI Responses API (`gpt-4o-mini` + `web_search_preview`) |
| 台本生成API | OpenAI Chat Completions API (`gpt-4o-mini`) |
| データベース | Supabase (PostgreSQL) |
| デプロイ | Vercel (Hobbyプラン、関数タイムアウト60秒) |

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
# .env.local
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Supabaseを使用しない場合、トピック・台本はインメモリキャッシュのみで動作する（お気に入り・履歴機能は無効）。

### 3. DBスキーマの適用（Supabase使用時）

`src/lib/db-schema.sql` をSupabaseのSQLエディタで実行する。

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。

### 5. 本番ビルド

```bash
npm run build
npm start
```

## ディレクトリ構造

```
talk-generator/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # APIルート（サーバーサイド）
│   │   │   ├── batch/route.ts        # POST /api/batch（バッチトピック生成）
│   │   │   ├── cache/route.ts        # GET /api/cache（キャッシュ統計）
│   │   │   ├── script/route.ts       # POST /api/script（台本生成）
│   │   │   ├── status/route.ts       # GET /api/status（APIステータス確認）
│   │   │   ├── topics/route.ts       # POST /api/topics（トピック生成）
│   │   │   └── usage/route.ts        # GET /api/usage（使用量取得）
│   │   ├── favorites/page.tsx        # お気に入り一覧ページ
│   │   ├── history/page.tsx          # 生成履歴ページ
│   │   ├── settings/page.tsx         # 設定ページ
│   │   ├── globals.css               # Tailwind CSS設定
│   │   ├── layout.tsx                # ルートレイアウト
│   │   ├── page.tsx                  # メインページ
│   │   └── viewport.ts               # Viewport設定
│   ├── components/                   # Reactコンポーネント
│   │   ├── icons/index.tsx           # アイコンコンポーネント集
│   │   ├── icons.tsx                 # アイコン定義
│   │   ├── ApiStatusIndicator.tsx    # APIステータス表示
│   │   ├── ErrorBoundary.tsx         # エラーバウンダリ
│   │   ├── LoadingSpinner.tsx        # ローディングアニメーション
│   │   ├── Navigation.tsx            # ナビゲーションバー
│   │   ├── TopicCard.tsx             # トピック表示カード
│   │   ├── TopicCardSkeleton.tsx     # トピックカードスケルトン
│   │   ├── TopicDetail.tsx           # トピック詳細モーダル
│   │   └── TopicList.tsx             # トピック一覧
│   ├── hooks/                        # カスタムフック
│   │   ├── useDebounce.ts            # デバウンス処理
│   │   ├── useScript.ts              # 台本生成ロジック
│   │   └── useTopics.ts              # トピック取得ロジック
│   ├── lib/                          # ユーティリティ・API関数
│   │   ├── cache.ts                  # インメモリ + Supabase DBキャッシュ
│   │   ├── config.ts                 # アプリ設定・定数
│   │   ├── database.types.ts         # Supabase生成型定義
│   │   ├── db.ts                     # Supabaseクライアント・DBキャッシュサービス
│   │   ├── db-schema.sql             # DBスキーマ定義
│   │   ├── mock-data.ts              # フォールバック用モックデータ
│   │   ├── openai-responses.ts       # OpenAI Responses API + Chat Completions実装
│   │   ├── rate-limit.ts             # クライアントサイドレート制限
│   │   ├── storage.ts                # LocalStorage永続化（設定・お気に入り）
│   │   └── supabase.ts               # Supabaseクライアント初期化
│   └── types/                        # TypeScript型定義
│       └── index.ts                  # 全型定義
├── .env.local                        # 環境変数（要作成）
├── next.config.js                    # Next.js設定
├── package.json                      # パッケージ管理
├── tailwind.config.js                # Tailwind CSS設定
├── tsconfig.json                     # TypeScript設定
├── vercel.json                       # Vercelデプロイ設定
└── README.md                         # このファイル
```

## API仕様

### POST /api/topics

フィルター条件に基づいてトピック一覧を生成する。OpenAI Responses APIのweb検索を使用。キャッシュヒット時はAPIを呼ばない。

**リクエスト**:
```typescript
{
  filters: {
    categories: string[];           // ['ニュース', 'エンタメ'] など
    includeIncidents: boolean;      // 事件事故を含めるか
    duration: 15 | 60 | 180;       // 尺（秒）
    tension: 'low' | 'medium' | 'high';
    tone: string;                   // 口調プリセット
  },
  previousTitles?: string[];        // 再生成時に除外するタイトル
}
```

**レスポンス**:
```typescript
{
  topics: Topic[];      // 最大15件
  cost: number;         // 今回のAPI利用コスト（USD）
  cached: boolean;
  cacheHitType?: 'exact' | 'fuzzy';
}
```

### POST /api/script

特定トピックの配信用台本を生成する。Chat Completions APIを使用。

**リクエスト**:
```typescript
{
  topicId: string;
  duration: 15 | 60 | 180;
  tension: 'low' | 'medium' | 'high';
  tone: string;
}
```

**レスポンス**:
```typescript
{
  script: {
    id: string;
    topicId: string;
    content: {
      opening?: string;           // つかみ
      explanation?: string;       // 説明
      streamerComment?: string;   // 配信者コメント
      viewerQuestions?: string[]; // 視聴者参加質問
      expansions?: string[];      // 話題の広げ方
      transition?: string;        // 次への繋ぎ
      // 事件事故トピックの場合
      factualReport?: string;
      seriousContext?: string;
      avoidanceNotes?: string;
    }
  },
  cost: number;
  cached: boolean;
}
```

### GET /api/usage

API使用量を取得する。

### GET /api/status

OpenAI APIとSupabaseの疎通状態を確認する。

### POST /api/batch

複数カテゴリのトピックをまとめて生成する。

### GET /api/cache

インメモリキャッシュの統計情報を取得する。

## キャッシュ・レート制限

### キャッシュ

- **インメモリキャッシュ**: トピック30分 / 台本3時間 / バッチ45分のTTL
- **Supabase DBキャッシュ**: Supabase設定時、インメモリ失効後もDBから復元
- **ファジーマッチング**: 類似フィルター条件のキャッシュヒットをサポート
- 再生成時（`previousTitles`指定）はキャッシュをスキップして常に新しい結果を取得

### レート制限

- クライアントサイドで1日30リクエストまで（JST午前0時リセット）
- LocalStorageで使用量を管理

## フォールバック動作

OpenAI APIキーが未設定、またはAPI呼び出しに失敗した場合、`src/lib/mock-data.ts` のモックデータを返す。

## セキュリティ

- `OPENAI_API_KEY` および `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使用（クライアントに露出しない）
- `vercel.json` でセキュリティヘッダー（`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`）を設定済み
- 入力値は全APIエンドポイントでバリデーション済み

## 今後の実装予定

### Phase 2: 機能拡張
- [ ] エクスポート機能（テキスト/PDF）
- [ ] 台本テンプレートのカスタマイズ

### Phase 3: 高度化
- [ ] 配信プラットフォーム連携（YouTube/Twitch）
- [ ] 音声読み上げプレビュー

## 実装済み機能

- [x] OpenAI Responses API統合（`web_search_preview`によるリアルタイム情報取得）
- [x] Chat Completions APIによる台本生成
- [x] Supabase DBキャッシュ（ファジーマッチング対応）
- [x] ユーザー設定の永続化（LocalStorage + Supabase）
- [x] お気に入り機能
- [x] 生成履歴機能
- [x] クライアントサイドレート制限（30回/日、JST午前0時リセット）
- [x] リアルタイムコスト表示
- [x] Vercelデプロイ

## トラブルシューティング

### ビルドエラーが発生する

```bash
npx tsc --noEmit    # 型エラーの確認
rm -rf node_modules package-lock.json
npm install
```

### 開発サーバーが起動しない

```bash
npx kill-port 3000
npm run dev
# または
npm run dev -- --port 3001
```

### トピック生成がモックデータを返す

`OPENAI_API_KEY` が `.env.local` に正しく設定されているか確認する。

## ライセンス

MIT License
