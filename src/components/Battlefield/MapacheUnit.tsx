import React, { useEffect, useRef, useState } from 'react'
import type { PlantEntity } from '../../types/game'
import {
  ensureMapacheTextures,
  createRig,
  applyPose,
  type MapacheRigInstance,
} from '../../utils/mapaches/mapachesRig'
import type { MapacheKey, MapacheCharDef } from '../../utils/mapaches/mapachesData'
import './MapacheUnit.css'

interface MapacheUnitProps {
  enemy: PlantEntity
  tick: number
  laneHeightPx?: number
}

const MAPACHE_IMAGES: Record<MapacheKey, string> = {
  pumpum: '/images/mapaches/pumpum.webp',
  garritas: '/images/mapaches/garritas.webp',
  punos: '/images/mapaches/punos.webp',
  navajas: '/images/mapaches/navajas.webp',
  reygarra: '/images/mapaches/reygarra.webp',
}

let cachedTemplates: Record<MapacheKey, MapacheCharDef> | null = null

export const MapacheUnit: React.FC<MapacheUnitProps> = ({
  enemy,
  tick: _tick,
  laneHeightPx = 95,
}) => {
  const mapacheKey = (enemy.mapacheKey || 'garritas') as MapacheKey
  const containerRef = useRef<HTMLDivElement>(null)
  const rigRef = useRef<MapacheRigInstance | null>(null)
  const [isRigReady, setIsRigReady] = useState<boolean>(() => Boolean(cachedTemplates && cachedTemplates[mapacheKey]?.urls))
  const isBoss = enemy.isBoss || mapacheKey === 'reygarra'

  // Altura visual adaptada al carril de combate
  const targetH = isBoss ? Math.round(laneHeightPx * 1.35) : Math.round(laneHeightPx * 0.95)

  useEffect(() => {
    let active = true

    if (cachedTemplates && cachedTemplates[mapacheKey]?.urls) {
      setIsRigReady(true)
      return
    }

    ensureMapacheTextures()
      .then((templates) => {
        if (!active) return
        cachedTemplates = templates
        setIsRigReady(true)
      })
      .catch((err) => {
        console.warn('Fallback a sprite estático para mapache:', mapacheKey, err)
      })

    return () => {
      active = false
    }
  }, [mapacheKey])

  // Montar y animar el rig
  useEffect(() => {
    if (!isRigReady || !containerRef.current || !cachedTemplates) return

    const ch = cachedTemplates[mapacheKey]
    if (!ch || !ch.urls) return

    // Limpiar contenedor previo
    containerRef.current.innerHTML = ''

    const rig = createRig(ch, targetH)
    rigRef.current = rig
    containerRef.current.appendChild(rig.root)

    let reqId: number
    const startTime = performance.now()

    const animate = (now: number) => {
      if (!rigRef.current) return

      const tSec = (now - startTime) / 1000
      const isAttacking = enemy.state === 'attacking'
      const isWalking = enemy.isWalking && !isAttacking

      if (ch.pose) {
        let pose: any
        if (mapacheKey === 'pumpum') {
          pose = isAttacking
            ? (ch as any).pose('shoot', tSec % 1.2)
            : (ch as any).pose('walk', tSec)
        } else if (mapacheKey === 'garritas') {
          pose = isAttacking
            ? (ch as any).pose('claw', tSec % 0.8)
            : (ch as any).pose('walk', tSec)
        } else if (mapacheKey === 'punos') {
          pose = isAttacking
            ? (ch as any).pose('punch', tSec % (enemy.isFury ? 0.45 : 0.85), enemy.isFury)
            : (ch as any).pose('walk', tSec)
        } else if (mapacheKey === 'navajas') {
          pose = isAttacking
            ? (ch as any).pose('throw', tSec % 1.0)
            : (ch as any).pose('walk', tSec)
        } else if (mapacheKey === 'reygarra') {
          pose = isAttacking
            ? (ch as any).pose('slam', tSec % 1.4)
            : (ch as any).pose('walk', tSec)
        } else {
          pose = ch.pose(isWalking ? 'walk' : 'rest', tSec * 4, tSec, isAttacking ? 0.5 : null)
        }

        if (pose) {
          applyPose(rigRef.current, pose)
        }
      }

      reqId = requestAnimationFrame(animate)
    }

    reqId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(reqId)
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      rigRef.current = null
    }
  }, [isRigReady, mapacheKey, targetH, enemy.state, enemy.isWalking, enemy.isFury])

  return (
    <div
      className={`mapache-unit-wrap ${isBoss ? 'mapache-unit-wrap--boss' : ''} ${
        enemy.isFury ? 'mapache-unit-wrap--fury' : ''
      }`}
      style={{
        width: `${Math.round(targetH * 0.85)}px`,
        height: `${targetH}px`,
      }}
    >
      {/* Insignia visual si está en modo furia */}
      {enemy.isFury && (
        <div className="mapache-fury-indicator">
          🔥 ¡FURIA x2!
        </div>
      )}

      {/* Corona flotante para el Rey Garra */}
      {isBoss && (
        <div className="mapache-boss-crown">
          👑
        </div>
      )}

      {/* Contenedor del rig DOM articulado */}
      <div
        ref={containerRef}
        className="mapache-rig-mount"
        style={{
          display: isRigReady ? 'block' : 'none',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      />

      {/* Fallback instantáneo sin latencia mientras cargan texturas */}
      {!isRigReady && (
        <img
          src={MAPACHE_IMAGES[mapacheKey]}
          alt={mapacheKey}
          className={`mapache-static-fallback ${enemy.isWalking ? 'mapache-static-fallback--walk' : ''}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      )}
    </div>
  )
}
export default MapacheUnit
