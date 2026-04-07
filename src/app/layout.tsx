import type { Metadata } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthProvider from '@/components/AuthProvider'
import AppShell from '@/components/AppShell'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import ClientOverlays from '@/components/ClientOverlays'

// セルフホストフォント（CSP対応・パフォーマンス最適化）
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
})

export const metadata: Metadata = {
  title: 'トーク生成ツール - 配信用リアルタイム・トーク生成',
  description: '配信者がボタン1つで最新ニュース・エンタメ・SNSトレンド・TikTok話題を取得し、配信でそのまま読めるトーク台本に自動変換するWebツール',
  keywords: '配信, トーク, 生成, ニュース, エンタメ, SNS, TikTok, ライブ配信',
  authors: [{ name: 'Talk Generator Team' }],
  creator: 'Talk Generator Team',
  publisher: 'Talk Generator',
  robots: 'index, follow',
  icons: {
    icon: '/icons/icon-192x192.svg',
    apple: '/icons/icon-192x192.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://talk-generator-beta.vercel.app',
    siteName: 'トーク生成ツール',
    title: 'トーク生成ツール - 配信用リアルタイム・トーク生成',
    description: '配信者がボタン1つで最新ニュース・エンタメ・SNSトレンド・TikTok話題を取得し、配信でそのまま読めるトーク台本に自動変換',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@talk_generator',
    creator: '@talk_generator',
    title: 'トーク生成ツール - 配信用リアルタイム・トーク生成',
    description: '配信者がボタン1つで最新トーク台本を生成！ニュース・エンタメ・SNS・TikTokトレンド対応',
  },
  metadataBase: new URL('https://talk-generator-beta.vercel.app'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" data-theme="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1f2937" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TalkGen" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body className={`min-h-screen bg-black text-white antialiased ${inter.variable} ${notoSansJP.variable}`}>
        <ClientOverlays />
        <GoogleAnalytics />
        <ServiceWorkerRegistrar />
        <ErrorBoundary>
          <AuthProvider>
            <AppShell>
              {children}
            </AppShell>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}