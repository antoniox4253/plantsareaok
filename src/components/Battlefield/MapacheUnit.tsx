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

  // Altura adaptada al carril de combate
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

  // Montar y animar el rig con las fórmulas cinemáticas exactas de template3.html
  useEffect(() => {
    if (!isRigReady || !containerRef.current || !cachedTemplates) return

    const ch = cachedTemplates[mapacheKey]
    if (!ch || !ch.urls) return

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
      const isWalking = enemy.isWalking

      if (ch.pose) {
        let pose: any

        if (mapacheKey === 'pumpum') {
          const walkPhase = tSec * 4.2
          const shootCycle = 1.2
          const act = isAttacking ? Math.max(0, 1 - (tSec % shootCycle) * 3) : 0
          const state = isWalking ? 'walk' : isAttacking ? 'hold' : 'hold'
          pose = ch.pose(state, walkPhase, tSec, act)
        } else if (mapacheKey === 'garritas') {
          const walkPhase = tSec * 5.2
          const isJumping = Boolean(enemy.hasJumped)
          if (isJumping && ch.jumpPose) {
            const jumpDuration = ch.jumpDur || 1.15
            const jumpProgress = Math.min(1, (tSec % (jumpDuration + 1.0)) / jumpDuration)
            rigRef.current.jumpScale = 0.5
            pose = ch.jumpPose(jumpProgress, tSec)
          } else {
            rigRef.current.jumpScale = 1
            const clawCycle = 0.65
            const act = isAttacking ? (tSec % clawCycle) / clawCycle : null
            const state = isWalking ? 'walk' : 'hold'
            pose = ch.pose(state, walkPhase, tSec, act)
          }
        } else if (mapacheKey === 'punos') {
          const isFury = Boolean(enemy.isFury)
          const walkPhase = tSec * 4.2
          const punchDur = isFury ? 0.35 : 0.6
          const act = isAttacking ? (tSec % punchDur) / punchDur : null
          const hand = Math.floor(tSec / punchDur) % 2
          const state = isWalking ? 'walk' : 'hold'
          pose = ch.pose(state, walkPhase, tSec, act, { fury: isFury ? 1 : 0, hand })
        } else if (mapacheKey === 'navajas') {
          const walkPhase = tSec * 4.8
          const throwCycle = 0.95
          const act = isAttacking ? (tSec % throwCycle) / throwCycle : null
          const state = isWalking ? 'walk' : 'hold'
          pose = ch.pose(state, walkPhase, tSec, act)
        } else if (mapacheKey === 'reygarra') {
          const walkPhase = tSec * 3.8
          const isRoaring = Boolean(enemy.isCommandoAura)
          const state = isWalking ? 'walk' : 'hold'
          if (isRoaring) {
            const act = (tSec % 1.3) / 1.3
            pose = ch.pose('hold', 0, tSec, act, { action: 'roar' })
          } else {
            const act = isAttacking ? (tSec % 1.0) / 1.0 : null
            pose = ch.pose(state, walkPhase, tSec, act)
          }
        } else {
          pose = ch.pose(isWalking ? 'walk' : 'rest', tSec * 4, tSec, isAttacking ? 0.5 : null)
        }

        if (pose && rigRef.current) {
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
  }, [isRigReady, mapacheKey, targetH, enemy.state, enemy.isWalking, enemy.isFury, enemy.isCommandoAura, enemy.hasJumped])

  return (
    <div
      className={`mapache-unit-wrap ${isBoss ? 'mapache-unit-wrap--boss' : ''} ${
        enemy.isFury ? 'mapache-unit-wrap--fury' : ''
      } ${enemy.isCommandoAura ? 'mapache-unit-wrap--buffed' : ''}`}
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

      {/* Rugido del Rey Garra */}
      {enemy.isCommandoAura && !isBoss && (
        <div className="mapache-buff-indicator">
          ⚡ ¡POTENCIADO!
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

      {/* Fallback instantáneo mientras cargan texturas */}
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
