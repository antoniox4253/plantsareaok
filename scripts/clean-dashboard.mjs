import sharp from 'sharp'

async function cleanDashboard() {
  const img = sharp('public/game-assets/dashboard/dashboard-original.png')
  const meta = await img.metadata()

  // SVG overlay that seamlessly clears the dummy texts while preserving borders, icons, crowns and pedestals
  const svgOverlay = Buffer.from(`
    <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="darkBadge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#081e15" />
          <stop offset="50%" stop-color="#061810" />
          <stop offset="100%" stop-color="#04120c" />
        </linearGradient>
        <linearGradient id="darkVip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#092419" />
          <stop offset="50%" stop-color="#061a12" />
          <stop offset="100%" stop-color="#04140d" />
        </linearGradient>
        <linearGradient id="darkOnline" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#082217" />
          <stop offset="100%" stop-color="#04130d" />
        </linearGradient>
        <linearGradient id="darkSlot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#081f18" />
          <stop offset="100%" stop-color="#04130e" />
        </linearGradient>
      </defs>

      <!-- Perfil Name area (clearing 'Admin') -->
      <rect x="274" y="47" width="98" height="60" rx="8" fill="url(#darkBadge)" />

      <!-- Pase VIP area (clearing 'PASE VIP', 'NIVEL 0/20' and bar) -->
      <rect x="440" y="47" width="180" height="60" rx="8" fill="url(#darkVip)" />

      <!-- En linea area (clearing '25 en linea' and dot) -->
      <rect x="836" y="47" width="170" height="60" rx="22" fill="url(#darkOnline)" />

      <!-- Oro number area (clearing '8,500') -->
      <rect x="1114" y="47" width="102" height="60" rx="8" fill="url(#darkBadge)" />

      <!-- Gemas number area (clearing '1,523') -->
      <rect x="1285" y="47" width="112" height="60" rx="8" fill="url(#darkBadge)" />

      <!-- Trofeos pill area (clearing entire trophy pill so top bar has Oro, Gemas, Tuerca) -->
      <rect x="1406" y="38" width="158" height="78" rx="14" fill="#05160e" opacity="0.98" />

      <!-- Torneo area (clearing old castle and baked texts: Temporada 1, 11d 22h 18m, Proximamente) -->
      <rect x="1208" y="130" width="442" height="290" rx="18" fill="url(#darkSlot)" opacity="0.98" />

      <!-- 4 Chest Slots: clearing dummy boxes and 'SLOT VACÍO' text -->
      <rect x="390" y="686" width="148" height="116" rx="14" fill="url(#darkSlot)" opacity="0.96" />
      <rect x="570" y="686" width="146" height="116" rx="14" fill="url(#darkSlot)" opacity="0.96" />
      <rect x="750" y="686" width="146" height="116" rx="14" fill="url(#darkSlot)" opacity="0.96" />
      <rect x="930" y="686" width="148" height="116" rx="14" fill="url(#darkSlot)" opacity="0.96" />
    </svg>
  `)

  // Save to dashboard-original.png so it is directly used by the app
  const buffer = await img
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .png()
    .toBuffer()

  await sharp(buffer).toFile('public/game-assets/dashboard/dashboard-original.png')

  console.log('Successfully updated public/game-assets/dashboard/dashboard-original.png')
}

cleanDashboard().catch(console.error)
