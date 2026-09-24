import { useEffect, useRef } from 'react'
import {
  ARENA_ADS_NATIVE_CONTAINER_ID,
  ARENA_ADS_NATIVE_SRC,
} from '../../utils/arenaAdsNetwork'

interface ArenaAdsNativeBannerProps {
  className?: string
  fallbackText?: string
}

export default function ArenaAdsNativeBanner({
  className = '',
  fallbackText = 'Publicidad Patrocinada • Arena ADS',
}: ArenaAdsNativeBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Inyectar el script del banner nativo cuando el contenedor esté montado
    const scriptId = 'arena-ads-native-invoke-script'
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
      // Al desmontar, si se requiere limpieza se puede gestionar
    }
  }, [])

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
