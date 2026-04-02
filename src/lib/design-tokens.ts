/**
 * デザイントークン定義
 * 2026年モダンUI基準の統一デザインシステム
 */

// ============================================================
// カラーパレット
// ============================================================
export const colors = {
  // ベースカラー（ディープネイビー/チャコール系）
  base: {
    bg:         '#0a0a0f',  // 最深背景
    bgAlt:      '#12121a',  // 代替背景
    surface:    '#1a1a28',  // カード・パネル背景
    surfaceAlt: '#1e1e2e',  // 代替サーフェス
    border:     '#2a2a3d',  // ボーダー
    borderAlt:  '#353550',  // 明るいボーダー
  },

  // アクセントカラー
  accent: {
    // シアン→ブルー系
    cyanStart:  '#00d4ff',
    cyanEnd:    '#0066ff',
    // マゼンタ→ピンク系
    magentaStart: '#ff00ff',
    magentaEnd:   '#ff0066',
    // エメラルド（成功）
    emerald:    '#00ff88',
    // アンバー（警告）
    amber:      '#ffaa00',
    // ローズ（エラー）
    rose:       '#ff4466',
  },

  // テキストカラー
  text: {
    primary:   '#f0f0ff',   // メインテキスト
    secondary: '#a0a0c0',   // サブテキスト
    muted:     '#606080',   // ミュートテキスト
    inverse:   '#0a0a0f',   // 反転テキスト
  },

  // グラデーション定義
  gradients: {
    cyanBlue:     'linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)',
    magentaPink:  'linear-gradient(135deg, #ff00ff 0%, #ff0066 100%)',
    purpleBlue:   'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
    emeraldCyan:  'linear-gradient(135deg, #00ff88 0%, #00d4ff 100%)',
    warmSunset:   'linear-gradient(135deg, #ff6b35 0%, #ff0066 100%)',
    hero:         'linear-gradient(135deg, #00d4ff 0%, #7c3aed 50%, #ff0066 100%)',
    meshBg:       'radial-gradient(ellipse at 20% 50%, rgba(0,212,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.08) 0%, transparent 60%), radial-gradient(ellipse at 60% 80%, rgba(255,0,102,0.06) 0%, transparent 60%)',
  },
} as const;

// ============================================================
// スペーシングスケール（4pxベース）
// ============================================================
export const spacing = {
  0:   '0px',
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  7:   '28px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
  16:  '64px',
  20:  '80px',
  24:  '96px',
  32:  '128px',
} as const;

// ============================================================
// ボーダー半径トークン
// ============================================================
export const borderRadius = {
  sm:   '8px',
  md:   '12px',
  lg:   '16px',
  xl:   '24px',
  '2xl': '32px',
  full: '9999px',
} as const;

// ============================================================
// シャドウトークン（カラーグロー付き）
// ============================================================
export const shadows = {
  // 標準シャドウ
  sm:   '0 2px 8px rgba(0, 0, 0, 0.4)',
  md:   '0 4px 16px rgba(0, 0, 0, 0.5)',
  lg:   '0 8px 32px rgba(0, 0, 0, 0.6)',
  xl:   '0 16px 64px rgba(0, 0, 0, 0.7)',

  // グローシャドウ（カラー付き）
  glowCyan:    '0 0 20px rgba(0, 212, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.5)',
  glowBlue:    '0 0 20px rgba(0, 102, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.5)',
  glowPurple:  '0 0 20px rgba(124, 58, 237, 0.3), 0 4px 16px rgba(0, 0, 0, 0.5)',
  glowMagenta: '0 0 20px rgba(255, 0, 102, 0.3), 0 4px 16px rgba(0, 0, 0, 0.5)',
  glowEmerald: '0 0 20px rgba(0, 255, 136, 0.3), 0 4px 16px rgba(0, 0, 0, 0.5)',
  glowAmber:   '0 0 20px rgba(255, 170, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.5)',

  // インナーシャドウ
  insetSm:  'inset 0 1px 3px rgba(0, 0, 0, 0.3)',
  insetMd:  'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
} as const;

// ============================================================
// タイポグラフィスケール
// ============================================================
export const typography = {
  // フォントスタック（Inter + Noto Sans JP）
  fontFamily: {
    sans: '"Inter", "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  },

  // フォントサイズ
  fontSize: {
    xs:   '12px',
    sm:   '14px',
    base: '16px',
    lg:   '18px',
    xl:   '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '60px',
    '7xl': '72px',
  },

  // フォントウェイト
  fontWeight: {
    normal:    '400',
    medium:    '500',
    semibold:  '600',
    bold:      '700',
    extrabold: '800',
    black:     '900',
  },

  // 行間
  lineHeight: {
    tight:   '1.2',
    snug:    '1.375',
    normal:  '1.5',
    relaxed: '1.625',
    loose:   '2',
  },
} as const;

// ============================================================
// グラスモーフィズムプリセット
// ============================================================
export const glassmorphism = {
  // ライト（薄い）
  light: {
    background:    'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(8px)',
    border:        '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow:     '0 4px 16px rgba(0, 0, 0, 0.3)',
  },
  // ミディアム（標準）
  medium: {
    background:    'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(16px)',
    border:        '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow:     '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  // ヘビー（濃い）
  heavy: {
    background:    'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(24px)',
    border:        '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow:     '0 16px 48px rgba(0, 0, 0, 0.5)',
  },
} as const;

// ============================================================
// アニメーショントークン
// ============================================================
export const animation = {
  duration: {
    fast:   '150ms',
    normal: '300ms',
    slow:   '500ms',
    slower: '700ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    spring:    'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ============================================================
// CSS カスタムプロパティ文字列（globals.cssに注入用）
// ============================================================
export const cssCustomProperties = `
  /* ベースカラー */
  --color-bg: ${colors.base.bg};
  --color-bg-alt: ${colors.base.bgAlt};
  --color-surface: ${colors.base.surface};
  --color-surface-alt: ${colors.base.surfaceAlt};
  --color-border: ${colors.base.border};
  --color-border-alt: ${colors.base.borderAlt};

  /* テキストカラー */
  --color-text-primary: ${colors.text.primary};
  --color-text-secondary: ${colors.text.secondary};
  --color-text-muted: ${colors.text.muted};

  /* アクセントカラー */
  --color-cyan: ${colors.accent.cyanStart};
  --color-blue: ${colors.accent.cyanEnd};
  --color-magenta: ${colors.accent.magentaStart};
  --color-pink: ${colors.accent.magentaEnd};
  --color-emerald: ${colors.accent.emerald};
  --color-amber: ${colors.accent.amber};
  --color-rose: ${colors.accent.rose};

  /* グラデーション */
  --gradient-cyan-blue: ${colors.gradients.cyanBlue};
  --gradient-magenta-pink: ${colors.gradients.magentaPink};
  --gradient-purple-blue: ${colors.gradients.purpleBlue};
  --gradient-emerald-cyan: ${colors.gradients.emeraldCyan};
  --gradient-hero: ${colors.gradients.hero};
  --gradient-mesh-bg: ${colors.gradients.meshBg};

  /* スペーシング */
  --space-1: ${spacing[1]};
  --space-2: ${spacing[2]};
  --space-3: ${spacing[3]};
  --space-4: ${spacing[4]};
  --space-6: ${spacing[6]};
  --space-8: ${spacing[8]};
  --space-12: ${spacing[12]};
  --space-16: ${spacing[16]};

  /* ボーダー半径 */
  --radius-sm: ${borderRadius.sm};
  --radius-md: ${borderRadius.md};
  --radius-lg: ${borderRadius.lg};
  --radius-xl: ${borderRadius.xl};
  --radius-2xl: ${borderRadius['2xl']};

  /* シャドウ */
  --shadow-sm: ${shadows.sm};
  --shadow-md: ${shadows.md};
  --shadow-lg: ${shadows.lg};
  --shadow-glow-cyan: ${shadows.glowCyan};
  --shadow-glow-blue: ${shadows.glowBlue};
  --shadow-glow-purple: ${shadows.glowPurple};
  --shadow-glow-magenta: ${shadows.glowMagenta};
  --shadow-glow-emerald: ${shadows.glowEmerald};
  --shadow-glow-amber: ${shadows.glowAmber};

  /* タイポグラフィ */
  --font-sans: ${typography.fontFamily.sans};
  --font-mono: ${typography.fontFamily.mono};

  /* グラスモーフィズム */
  --glass-light-bg: ${glassmorphism.light.background};
  --glass-medium-bg: ${glassmorphism.medium.background};
  --glass-heavy-bg: ${glassmorphism.heavy.background};
  --glass-light-border: ${glassmorphism.light.border};
  --glass-medium-border: ${glassmorphism.medium.border};
  --glass-heavy-border: ${glassmorphism.heavy.border};

  /* アニメーション */
  --duration-fast: ${animation.duration.fast};
  --duration-normal: ${animation.duration.normal};
  --duration-slow: ${animation.duration.slow};
  --easing-standard: ${animation.easing.standard};
  --easing-spring: ${animation.easing.spring};
`;

// デフォルトエクスポート（全トークンオブジェクト）
const designTokens = {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
  glassmorphism,
  animation,
  cssCustomProperties,
};

export default designTokens;
