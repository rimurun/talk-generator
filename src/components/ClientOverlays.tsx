'use client'

import dynamic from 'next/dynamic'

// SSR無効でインポート（canvas/hydrationエラー回避）
const ParticleField = dynamic(() => import('@/components/ParticleField'), { ssr: false })
const HudOverlay = dynamic(() => import('@/components/HudOverlay'), { ssr: false })
const CyberGrid = dynamic(() => import('@/components/CyberGrid'), { ssr: false })
const DataStream = dynamic(() => import('@/components/DataStream'), { ssr: false })

export default function ClientOverlays() {
  return (
    <>
      <ParticleField />
      <CyberGrid />
      <HudOverlay />
      <DataStream />
    </>
  )
}
