'use client'

import dynamic from 'next/dynamic'

// SSR無効でインポート（canvas/hydrationエラー回避）
const ParticleField = dynamic(() => import('@/components/ParticleField'), { ssr: false })
const HudOverlay = dynamic(() => import('@/components/HudOverlay'), { ssr: false })

export default function ClientOverlays() {
  return (
    <>
      <ParticleField />
      <HudOverlay />
    </>
  )
}
