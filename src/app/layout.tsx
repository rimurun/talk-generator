import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthProvider from '@/components/AuthProvider'
import AppShell from '@/components/AppShell'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: 'トーク生成ツール - 配信用リアルタイム・トーク生成',
  description: '配信者がボタン1つで最新ニュース・エンタメ・SNSトレンド・TikTok話題を取得し、配信でそのまま読めるトーク台本に自動変換するWebツール',
  keywords: '配信, トーク, 生成, ニュース, エンタメ, SNS, TikTok, ライブ配信',
  authors: [{ name: 'Talk Generator Team' }],
  creator: 'Talk Generator Team',
  publisher: 'Talk Generator',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://talk-generator-beta.vercel.app',
    siteName: 'トーク生成ツール',
    title: 'トーク生成ツール - 配信用リアルタイム・トーク生成',
    description: '配信者がボタン1つで最新ニュース・エンタメ・SNSトレンド・TikTok話題を取得し、配信でそのまま読めるトーク台本に自動変換',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'トーク生成ツール',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@talk_generator',
    creator: '@talk_generator',
    title: 'トーク生成ツール - 配信用リアルタイム・トーク生成',
    description: '配信者がボタン1つで最新トーク台本を生成！ニュース・エンタメ・SNS・TikTokトレンド対応',
    images: ['/og-image.png'],
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TalkGen" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body className="min-h-screen bg-black text-white antialiased">
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