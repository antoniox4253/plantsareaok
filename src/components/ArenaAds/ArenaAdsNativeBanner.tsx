import {
  ARENA_ADS_NATIVE_CONTAINER_ID,
  ARENA_ADS_NATIVE_SRC,
} from '../../utils/arenaAdsNetwork'

interface ArenaAdsNativeBannerProps {
  className?: string
  fallbackText?: string
  enabled?: boolean
  lateral?: boolean
  refreshKey?: string | number
}

export default function ArenaAdsNativeBanner({
  className = '',
  fallbackText = 'Patrocinador Oficial • Arena ADS',
  enabled = true,
  lateral = false,
  refreshKey,
}: ArenaAdsNativeBannerProps) {
  if (!enabled) {
    return (
      <div className={`arena-ads-native-banner-box ${className}`} style={{ minHeight: lateral ? '100%' : '50px' }}>
        <div className="arena-ads-native-header">
          <span className="arena-ads-native-badge">[ PUBLICIDAD / AD ]</span>
          <span className="arena-ads-native-title">{fallbackText}</span>
        </div>
      </div>
    )
  }

  const cacheBusterSrc = refreshKey !== undefined
    ? `${ARENA_ADS_NATIVE_SRC}?t=${encodeURIComponent(String(refreshKey))}`
    : ARENA_ADS_NATIVE_SRC

  const iframeSrcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #${ARENA_ADS_NATIVE_CONTAINER_ID} {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  </style>
  <script async="async" data-cfasync="false" src="${cacheBusterSrc}"></script>
</head>
<body>
  <div id="${ARENA_ADS_NATIVE_CONTAINER_ID}"></div>
</body>
</html>`

  if (lateral) {
    return (
      <div className={`arena-ads-native-lateral-wrap ${className}`} style={{ width: '100%', height: '100%' }}>
        <iframe
          key={refreshKey !== undefined ? String(refreshKey) : undefined}
          title="Arena Ads Lateral Native Banner"
          className="arena-ads-combat-flank-iframe"
          srcDoc={iframeSrcDoc}
          style={{ width: '100%', height: '100%', border: 'none', overflow: 'hidden' }}
        />
      </div>
    )
  }

  return (
    <div className={`arena-ads-native-banner-box ${className}`}>
      <div className="arena-ads-native-header">
        <span className="arena-ads-native-badge">[ PUBLICIDAD / AD ]</span>
        <span className="arena-ads-native-title">{fallbackText}</span>
      </div>

      <div className="arena-ads-native-container">
        <iframe
          key={refreshKey !== undefined ? String(refreshKey) : undefined}
          title="Arena Ads Native Banner"
          className="arena-ads-combat-flank-iframe"
          srcDoc={iframeSrcDoc}
          style={{ width: '100%', minHeight: '85px', height: '90px', border: 'none', overflow: 'hidden' }}
        />
      </div>
    </div>
  )
}
