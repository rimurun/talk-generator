# 配信用リアルタイム・トーク生成ツール

配信者がボタン1つで最新ニュース・エンタメ・SNSトレンド・TikTok話題を取得し、配信でそのまま読めるトーク台本に自動変換するWebツール。

## 🎯 特徴

- **リアルタイム情報収集**: 最新のニュース・エンタメ・SNS・TikTokトレンドを自動収集
- **配信特化台本**: つかみ→説明→コメント→視聴者質問→次の話題への流れを完全自動生成
- **炎上リスク管理**: 各トピックにリスクレベルを表示、事件事故は専用テンプレート適用
- **カスタマイズ豊富**: 尺（15秒〜3分）・テンション・口調を細かく設定可能
- **ワンクリックコピー**: 生成された台本を即座にクリップボードへ

## 📱 機能一覧

### 🎪 トピック生成
- **カテゴリフィルター**: ニュース・エンタメ・SNS・TikTok・事件事故から選択
- **全選択/全解除**: カテゴリを一括操作可能
- **事件事故切り替え**: センシティブな内容を含めるか選択

### ⚙️ カスタマイズオプション
- **尺設定**: 15秒（短文）/ 1分（標準）/ 3分（詳細）
- **テンション**: 低（落ち着いた）/ 中（標準）/ 高（エネルギッシュ）
- **口調プリセット**: フレンドリー / エネルギッシュ / 落ち着いた / コメディ重視 / バランス重視 / 事実重視

### 📊 リスク管理
- **センシティブ度表示**: 1-3段階でコンテンツの注意度を表示
- **炎上リスク表示**: low / medium / high でリスクレベルを表示
- **事件事故専用テンプレート**: 煽らない・断定しない・事実ベースの安全な報道スタイル

## 🚀 セットアップ手順

### 1. プロジェクトのクローン
```bash
git clone <repository-url>
cd talk-generator
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 環境変数の設定（将来のAPI利用のため）
```bash
cp .env.example .env.local
# .env.localを編集してOpenAI APIキーを設定
```

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

## 🔧 OpenAI API差し替え方法

現在はモックデータを使用していますが、将来的にOpenAI APIを使用する場合：

### 1. APIキーの取得
[OpenAI Platform](https://platform.openai.com/api-keys)でAPIキーを取得

### 2. 環境変数の設定
```bash
# .env.local
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. lib/openai.tsの修正
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TODO コメントを外して実装を置き換え
```

## 📁 ディレクトリ構造

```
talk-generator/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes（サーバーサイド）
│   │   │   ├── topics/        # トピック生成API
│   │   │   │   └── route.ts   # POST /api/topics
│   │   │   ├── script/        # 台本生成API  
│   │   │   │   └── route.ts   # POST /api/script
│   │   │   └── usage/         # 使用量取得API
│   │   │       └── route.ts   # GET /api/usage
│   │   ├── globals.css        # Tailwind CSS設定
│   │   ├── layout.tsx         # ルートレイアウト
│   │   └── page.tsx           # メインページ（クライアントサイド）
│   ├── components/            # Reactコンポーネント
│   │   ├── LoadingSpinner.tsx # ローディングアニメーション
│   │   ├── TopicCard.tsx      # トピック表示カード
│   │   ├── TopicDetail.tsx    # トピック詳細モーダル
│   │   └── TopicList.tsx      # トピック一覧
│   ├── lib/                   # ユーティリティ・API関数
│   │   ├── mock-data.ts       # モックデータ（15件のトピック）
│   │   └── openai.ts          # OpenAI API関数（現在はモック実装）
│   └── types/                 # TypeScript型定義
│       └── index.ts           # 全型定義
├── .env.example               # 環境変数テンプレート
├── .gitignore                 # Git除外設定
├── next.config.js             # Next.js設定
├── package.json               # パッケージ管理
├── postcss.config.js          # PostCSS設定
├── tailwind.config.js         # Tailwind CSS設定
├── tsconfig.json              # TypeScript設定
└── README.md                  # このファイル
```

## 🔌 API仕様

### POST /api/topics
**概要**: フィルター条件に基づいてトピック一覧を生成

**リクエスト**:
```typescript
{
  filters: {
    categories: string[];           // ['ニュース', 'エンタメ'] など
    includeIncidents: boolean;      // 事件事故を含めるか
    duration: 15 | 60 | 180;       // 尺（秒）
    tension: 'low' | 'medium' | 'high';  // テンション
    tone: string;                   // 口調プリセット
  }
}
```

**レスポンス**:
```typescript
{
  topics: Topic[];  // 最大15件のトピック配列
}
```

### POST /api/script
**概要**: 特定トピックの配信用台本を生成

**リクエスト**:
```typescript
{
  topicId: string;                    // トピックID
  duration: 15 | 60 | 180;           // 尺（秒）
  tension: 'low' | 'medium' | 'high'; // テンション
  tone: string;                       // 口調プリセット
}
```

**レスポンス**:
```typescript
{
  script: {
    id: string;
    topicId: string;
    content: {
      // 通常トピック
      opening?: string;           // つかみ
      explanation?: string;       // 説明
      streamerComment?: string;   // 配信者コメント
      viewerQuestions?: string[]; // 視聴者参加質問
      expansions?: string[];      // 話題の広げ方
      transition?: string;        // 次への繋ぎ
      
      // 事件事故トピック
      factualReport?: string;     // 事実報告
      seriousContext?: string;    // 真面目な文脈
      avoidanceNotes?: string;    // 避けるべき表現
    }
  }
}
```

### GET /api/usage
**概要**: API使用状況を取得

**レスポンス**:
```typescript
{
  tokensUsed: number;     // 使用トークン数
  tokensLimit: number;    // 制限トークン数
  requestsUsed: number;   // リクエスト数
  requestsLimit: number;  // 制限リクエスト数
}
```

## 🎨 UI/UX特徴

### レスポンシブデザイン
- **デスクトップ**: 6カラムグリッドで最適化
- **タブレット**: 2-3カラムに自動調整
- **モバイル**: 1カラム縦積みレイアウト

### アクセシビリティ
- **キーボードナビゲーション**: 全ての操作をキーボードで実行可能
- **カラーコントラスト**: WCAG 2.1 AA準拠の色使い
- **スクリーンリーダー**: 適切なラベル・ARIAロール設定

### パフォーマンス
- **レイジーローディング**: 画像・コンポーネントの遅延読み込み
- **APIキャッシュ**: 使用量情報の適切なキャッシュ
- **バンドル最適化**: Tree shakingによる不要コード除去

## 🔐 セキュリティ考慮事項

- **入力検証**: 全APIエンドポイントでリクエスト検証実装
- **XSS対策**: React標準のエスケープ処理
- **CORS設定**: 適切なオリジン制限
- **環境変数**: センシティブ情報の安全な管理

## 📈 パフォーマンス最適化

- **コードスプリッティング**: ページ単位の遅延読み込み
- **画像最適化**: Next.js Image componentの活用
- **フォント最適化**: Webフォントの効率的読み込み
- **静的生成**: ビルド時の事前レンダリング

## 🧪 今後の実装予定

### Phase 1: AI統合
- [ ] OpenAI GPT-5.2 API統合
- [ ] Web検索機能による最新情報取得
- [ ] より自然な日本語台本生成

### Phase 2: 機能拡張  
- [ ] ユーザー設定の永続化（Local Storage）
- [ ] トピックお気に入り機能
- [ ] 台本テンプレートのカスタマイズ
- [ ] エクスポート機能（PDF/テキスト）

### Phase 3: 高度化
- [ ] 配信プラットフォーム連携（YouTube/Twitch）
- [ ] リアルタイム共同編集
- [ ] 音声読み上げ機能
- [ ] A/Bテスト機能

## 🐛 トラブルシューティング

### よくある問題

#### 1. npm install が失敗する
```bash
# Node.jsのバージョンを確認
node --version  # 18.17以上推奨

# キャッシュをクリア
npm cache clean --force
npm install
```

#### 2. ビルドエラーが発生する
```bash
# 型エラーの確認
npx tsc --noEmit

# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install
```

#### 3. 開発サーバーが起動しない
```bash
# ポートの確認（3000が使用中の場合）
npx kill-port 3000
npm run dev

# または別ポートで起動
npm run dev -- --port 3001
```

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

## 📧 サポート

問題や質問がある場合は、[Issues](../../issues)で報告してください。