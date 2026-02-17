import { Topic, Script } from '@/types';

export const mockTopics: Topic[] = [
  {
    id: '1',
    title: 'ChatGPT-5の大幅アップデートで日本語対応強化',
    category: 'ニュース',
    summary: 'OpenAIが次世代AI「ChatGPT-5」を発表。日本語の理解力と生成能力が飛躍的に向上し、より自然な会話が可能に。企業向けサービスも拡充予定。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/news/chatgpt5',
    createdAt: '2026-02-17T10:00:00Z'
  },
  {
    id: '2',
    title: '人気YouTuberの炎上騒動、事務所が謝罪コメント発表',
    category: 'エンタメ',
    summary: 'チャンネル登録者数100万人超えのYouTuberが不適切発言で炎上。所属事務所が公式謝罪し、一時的な活動休止を発表。ファンからは賛否両論の声。',
    sensitivityLevel: 2,
    riskLevel: 'medium',
    sourceUrl: 'https://example.com/entertainment/youtuber-controversy',
    createdAt: '2026-02-17T09:30:00Z'
  },
  {
    id: '3',
    title: 'X(旧Twitter)で新機能「音声つぶやき」が日本でもスタート',
    category: 'SNS',
    summary: 'イーロン・マスク氏のX社が音声投稿機能を日本でも開始。最大2分間の音声をポストに添付可能。インフルエンサーたちが早速活用を開始している。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/social/x-voice-feature',
    createdAt: '2026-02-17T08:45:00Z'
  },
  {
    id: '4',
    title: 'TikTokで話題の「10秒料理チャレンジ」が世界的ブームに',
    category: 'TikTok',
    summary: '10秒以内で作れる簡単料理を紹介する動画が大バズり中。日本の高校生が始めたチャレンジが海外でも爆発的人気。レシピ本の出版も決定。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/tiktok/10sec-cooking',
    createdAt: '2026-02-17T07:20:00Z'
  },
  {
    id: '5',
    title: '東京都内でサイバー攻撃による大規模システム障害発生',
    category: '事件事故',
    summary: '都庁を含む複数の公的機関でシステム障害が発生。サイバー攻撃の可能性が指摘されており、警察が捜査を開始。市民生活への影響は限定的とのこと。',
    sensitivityLevel: 3,
    riskLevel: 'high',
    sourceUrl: 'https://example.com/news/cyber-attack-tokyo',
    createdAt: '2026-02-17T06:15:00Z'
  },
  {
    id: '6',
    title: 'Netflix新作アニメが海外で高評価、日本アニメ人気再燃',
    category: 'エンタメ',
    summary: 'Netflixオリジナルアニメ「サムライの刃」が海外で絶賛される。日本の伝統文化を現代風にアレンジした作品で、国際的なアニメブームを牽引。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/entertainment/netflix-anime',
    createdAt: '2026-02-17T05:30:00Z'
  },
  {
    id: '7',
    title: 'Instagram新機能「リール共同編集」で創作活動が活発化',
    category: 'SNS',
    summary: 'Instagramが複数人でリール動画を編集できる機能を追加。クリエイター同士のコラボレーションが簡単になり、新しい表現手法が続々登場。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/social/instagram-collab',
    createdAt: '2026-02-17T04:45:00Z'
  },
  {
    id: '8',
    title: '暗号通貨市場で大幅な価格変動、規制強化の影響か',
    category: 'ニュース',
    summary: 'ビットコインをはじめとする主要暗号通貨が一斉に下落。各国の規制強化方針が影響しているとの見方が強い。投資家の間では警戒感が広がっている。',
    sensitivityLevel: 2,
    riskLevel: 'medium',
    sourceUrl: 'https://example.com/news/crypto-regulation',
    createdAt: '2026-02-17T03:20:00Z'
  },
  {
    id: '9',
    title: 'TikTokで「日本の文化紹介」動画が急上昇トレンド入り',
    category: 'TikTok',
    summary: '海外のクリエイターが日本の伝統文化や現代カルチャーを紹介する動画が人気急上昇。特に茶道や書道の動画は数百万回再生を記録している。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/tiktok/japan-culture',
    createdAt: '2026-02-17T02:15:00Z'
  },
  {
    id: '10',
    title: '大手テック企業でAI開発者の争奪戦が激化',
    category: 'ニュース',
    summary: 'GAFAM各社がAI人材の獲得競争を展開。年収1000万円超えの求人が急増し、転職市場が活況。日本企業も対抗策を模索している状況。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/news/ai-talent-war',
    createdAt: '2026-02-17T01:30:00Z'
  },
  {
    id: '11',
    title: '人気俳優が電撃結婚発表、相手は一般女性',
    category: 'エンタメ',
    summary: '朝ドラで大ブレイクした人気俳優が電撃結婚を発表。お相手は3年間交際していた一般女性で、ファンからは祝福の声が殺到している。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/entertainment/actor-marriage',
    createdAt: '2026-02-17T00:45:00Z'
  },
  {
    id: '12',
    title: 'Facebook新機能「バーチャル会議室」が在宅勤務を変える',
    category: 'SNS',
    summary: 'Meta社がFacebookに仮想現実技術を活用した会議機能を追加。VRヘッドセット不要でブラウザから参加可能。リモートワークの新スタンダードになる可能性。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/social/facebook-vr-meeting',
    createdAt: '2026-02-16T23:30:00Z'
  },
  {
    id: '13',
    title: 'TikTokで「1分間瞑想チャレンジ」が精神的健康ブーム牽引',
    category: 'TikTok',
    summary: '短時間瞑想を紹介するTikTok動画が若者の間で大流行。ストレス社会への対処法として注目され、メンタルヘルス専門家も推奨している。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/tiktok/meditation-challenge',
    createdAt: '2026-02-16T22:15:00Z'
  },
  {
    id: '14',
    title: '電車内でのトラブルが増加、鉄道会社が対策強化',
    category: '事件事故',
    summary: '首都圏の鉄道各社で、乗客同士のトラブルや迷惑行為の報告が前年比20%増加。鉄道会社は警備体制を強化し、啓発キャンペーンを実施予定。',
    sensitivityLevel: 2,
    riskLevel: 'medium',
    sourceUrl: 'https://example.com/incidents/train-troubles',
    createdAt: '2026-02-16T21:00:00Z'
  },
  {
    id: '15',
    title: '新型スマートフォンが5G通信速度で世界記録を更新',
    category: 'ニュース',
    summary: '国内メーカーが開発した新型スマートフォンが5G通信で理論値を上回る速度を実現。6G技術への橋渡し役として業界から注目を集めている。',
    sensitivityLevel: 1,
    riskLevel: 'low',
    sourceUrl: 'https://example.com/news/5g-smartphone-record',
    createdAt: '2026-02-16T20:30:00Z'
  }
];

export const mockScripts: Record<string, Script> = {
  '1': {
    id: 'script-1',
    topicId: '1',
    duration: 60,
    tension: 'medium',
    tone: 'フレンドリー',
    content: {
      opening: 'みなさん、こんにちは！今日はとんでもないニュースが飛び込んできました！',
      explanation: 'なんと、OpenAIがChatGPT-5を発表したんです。これまでの日本語対応がちょっと微妙だったのが、今度は飛躍的に向上したとのこと。もう機械翻訳っぽい変な日本語とはおさらばですね！',
      streamerComment: '正直、これは配信者にとっても朗報ですよ。AIが自然な日本語で会話できるようになれば、視聴者の皆さんとのやり取りでも活用できるかもしれません。',
      viewerQuestions: [
        'どんな機能が一番気になりますか？',
        '今使ってるAIサービスはありますか？',
        '配信でAI使ったら面白そうだと思いませんか？'
      ],
      expansions: [
        'AI技術の進歩と今後の予測について',
        '他社のAIサービスとの比較',
        '配信業界への影響について'
      ],
      transition: 'さて、AIの話が出たところで、次は少し違う話題に移りましょうか。'
    }
  },
  '2': {
    id: 'script-2',
    topicId: '2',
    duration: 60,
    tension: 'low',
    tone: 'バランス重視',
    content: {
      opening: 'ちょっと重めの話題になってしまいますが、エンタメ業界で気になるニュースがありました。',
      explanation: '人気YouTuberの方が不適切な発言で炎上し、事務所が謝罪コメントを出したそうです。詳細は控えますが、一時的に活動休止となったようですね。',
      streamerComment: '配信者として、言葉の重要性は常に意識しています。たくさんの人が見てくれているからこそ、責任を持って発言したいと思います。',
      viewerQuestions: [
        'みなさんは配信で気をつけていることはありますか？',
        '言葉選びで大切だと思うことはありますか？',
        'エンターテイメントと責任のバランスについてどう思いますか？'
      ],
      expansions: [
        '配信者の責任と表現の自由について',
        'SNS時代のコミュニケーションについて',
        'エンタメ業界の現状について'
      ],
      transition: 'では、もう少し明るい話題に移りましょうか。'
    }
  },
  '5': {
    id: 'script-5',
    topicId: '5',
    duration: 60,
    tension: 'low',
    tone: '事実重視',
    content: {
      factualReport: '東京都内でシステム障害が発生し、サイバー攻撃の可能性について警察が調査を開始したとの報告があります。',
      seriousContext: '現時点で公表されている情報では、都庁を含む複数の公的機関でシステムに不具合が生じており、市民生活への大きな影響は報告されていないとのことです。',
      avoidanceNotes: '詳細な情報や憶測については控え、正式な発表を待つ必要があります。セキュリティに関する事案のため、慎重な対応が求められています。'
    }
  }
};

export const tonePresets = [
  'フレンドリー',
  'エネルギッシュ',
  '落ち着いた',
  'コメディ重視',
  'バランス重視',
  '事実重視'
];

export const categoryOptions = [
  { value: 'ニュース', label: 'ニュース' },
  { value: 'エンタメ', label: 'エンタメ' },
  { value: 'SNS', label: 'SNS' },
  { value: 'TikTok', label: 'TikTok' },
  { value: '事件事故', label: '事件事故' }
];

export const durationOptions = [
  { value: 15, label: '15秒' },
  { value: 60, label: '1分' },
  { value: 180, label: '3分' }
];

export const tensionOptions = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
];