import { useEffect, useRef } from 'react'
import {
  ARENA_ADS_NATIVE_CONTAINER_ID,
  ARENA_ADS_NATIVE_SRC,
  isCombatAdsBlocked,
} from '../../utils/arenaAdsNetwork'

interface ArenaAdsNativeBannerProps {
  className?: string
  fallbackText?: string
  enabled?: boolean
}

export default function ArenaAdsNativeBanner({
  className = '',
  fallbackText = 'Publicidad Patrocinada • Arena ADS',
  enabled = true,
}: ArenaAdsNativeBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scriptId = 'arena-ads-native-invoke-script'
    if (!enabled || isCombatAdsBlocked()) {
      const existing = document.getElementById(scriptId)
      if (existing) existing.remove()
      return
    }

    // Inyectar el script del banner nativo cuando el contenedor esté montado
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = ARENA_ADS_NATIVE_SRC
      script.async = true
      script.setAttribute('data-cfasync', 'false')
      document.body.appendChild(script)
    }

    return () => {
      // Limpieza controlada
    }
  }, [enabled])

  return (
    <div className={`arena-ads-native-banner-box ${className}`}>
      <div className="arena-ads-native-header">
        <span className="arena-ads-native-badge">[ PUBLICIDAD / AD ]</span>
        <span className="arena-ads-native-title">{fallbackText}</span>
      </div>

      <div
        ref={containerRef}
        id={ARENA_ADS_NATIVE_CONTAINER_ID}
        className="arena-ads-native-container"
      />
    </div>
  )
}
