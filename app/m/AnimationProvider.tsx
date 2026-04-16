'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'

/* ─── Types ─── */

type CelebLevel = 'small' | 'medium' | 'big' | 'legendary'

type ChestRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'divine'
  | 'eternal'

interface AnimCtx {
  /** 小星星從按鈕噴出 */
  starBurst: (x: number, y: number) => void
  /** 浮動 +分數 */
  scorePopup: (text: string, x: number, y: number) => void
  /** 慶祝動畫（4 級） */
  celebrate: (level: CelebLevel) => void
  /** 寶箱開啟動畫 */
  openChest: (rarity: ChestRarity, reward: number) => void
}

const AnimationContext = createContext<AnimCtx>({
  starBurst: () => {},
  scorePopup: () => {},
  celebrate: () => {},
  openChest: () => {},
})

export function useAnimation() {
  return useContext(AnimationContext)
}

/* ─── Particle helpers ─── */

interface Particle {
  id: number
  x: number
  y: number
  emoji: string
  dx: number
  dy: number
  size: number
  duration: number
  delay: number
}

interface ScoreFloat {
  id: number
  text: string
  x: number
  y: number
}

interface CelebState {
  level: CelebLevel
  id: number
}

interface ChestState {
  rarity: ChestRarity
  reward: number
  id: number
  phase: 'glow' | 'open' | 'reveal' | 'done'
}

let _pid = 0
function nextId() {
  return ++_pid
}

/* ─── Rarity config ─── */

const RARITY_CONFIG: Record<
  ChestRarity,
  { color: string; glow: string; label: string; particleCount: number }
> = {
  common: { color: '#8B8FA3', glow: '#8B8FA355', label: '普通', particleCount: 8 },
  uncommon: { color: '#3FB97A', glow: '#3FB97A55', label: '不凡', particleCount: 12 },
  rare: { color: '#4A9EFF', glow: '#4A9EFF55', label: '稀有', particleCount: 16 },
  epic: { color: '#A060FF', glow: '#A060FF55', label: '史詩', particleCount: 20 },
  legendary: { color: '#FFD86B', glow: '#FFD86B55', label: '傳說', particleCount: 28 },
  mythic: { color: '#FF5252', glow: '#FF525255', label: '神話', particleCount: 32 },
  divine: { color: '#FF8C42', glow: '#FF8C4255', label: '神聖', particleCount: 36 },
  eternal: { color: '#FFB3D1', glow: '#FFB3D155', label: '永恆', particleCount: 44 },
}

/* ─── Provider ─── */

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [scores, setScores] = useState<ScoreFloat[]>([])
  const [celeb, setCeleb] = useState<CelebState | null>(null)
  const [chest, setChest] = useState<ChestState | null>(null)

  const celebTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* star burst — 小星星從 (x,y) 噴射 */
  const starBurst = useCallback((x: number, y: number) => {
    const emojis = ['⭐', '✨', '🌟', '💫']
    const newP: Particle[] = Array.from({ length: 10 }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 40 + Math.random() * 80
      return {
        id: nextId(),
        x,
        y,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        size: 12 + Math.random() * 10,
        duration: 600 + Math.random() * 400,
        delay: Math.random() * 100,
      }
    })
    setParticles((prev) => [...prev, ...newP])
    setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newP.find((np) => np.id === p.id)),
      )
    }, 1200)
  }, [])

  /* score popup — +100 浮動 */
  const scorePopup = useCallback((text: string, x: number, y: number) => {
    const s: ScoreFloat = { id: nextId(), text, x, y }
    setScores((prev) => [...prev, s])
    setTimeout(() => {
      setScores((prev) => prev.filter((sc) => sc.id !== s.id))
    }, 1500)
  }, [])

  /* celebrate — 4 級慶祝 */
  const celebrate = useCallback(
    (level: CelebLevel) => {
      if (celebTimer.current) clearTimeout(celebTimer.current)
      const c: CelebState = { level, id: nextId() }
      setCeleb(c)

      // 成交用震動
      if (level === 'legendary' && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 500])
      }

      const durations: Record<CelebLevel, number> = {
        small: 1200,
        medium: 2500,
        big: 3500,
        legendary: 10000,
      }
      celebTimer.current = setTimeout(() => {
        setCeleb(null)
        celebTimer.current = null
      }, durations[level])
    },
    [],
  )

  /* chest open — 寶箱動畫 */
  const openChest = useCallback((rarity: ChestRarity, reward: number) => {
    const id = nextId()
    setChest({ rarity, reward, id, phase: 'glow' })
    // glow → open → reveal → done
    setTimeout(() => setChest((c) => c && c.id === id ? { ...c, phase: 'open' } : c), 800)
    setTimeout(() => setChest((c) => c && c.id === id ? { ...c, phase: 'reveal' } : c), 1600)
    setTimeout(() => setChest(null), 4000)
  }, [])

  const ctx: AnimCtx = { starBurst, scorePopup, celebrate, openChest }

  return (
    <AnimationContext.Provider value={ctx}>
      {children}

      {/* ─── CSS keyframes (injected once) ─── */}
      <style>{`
        @keyframes mba-float-up {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(1.3); }
        }
        @keyframes mba-particle {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
        }
        @keyframes mba-rain {
          0% { opacity: 1; transform: translateY(-20px) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
        @keyframes mba-cat-bounce {
          0% { transform: translateY(100%) scale(0.5); opacity: 0; }
          30% { transform: translateY(-10%) scale(1.1); opacity: 1; }
          50% { transform: translateY(0) scale(1); }
          70% { transform: translateY(-5%) scale(1.05); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes mba-cat-dance {
          0% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-15deg) scale(1.1); }
          30% { transform: rotate(15deg) scale(1); }
          45% { transform: rotate(-10deg) scale(1.15); }
          60% { transform: rotate(10deg) scale(1); }
          75% { transform: rotate(-5deg) scale(1.1); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes mba-firework {
          0% { transform: scale(0); opacity: 1; }
          50% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes mba-glow-pulse {
          0% { box-shadow: 0 0 20px var(--glow-color); transform: scale(1); }
          50% { box-shadow: 0 0 60px var(--glow-color); transform: scale(1.05); }
          100% { box-shadow: 0 0 20px var(--glow-color); transform: scale(1); }
        }
        @keyframes mba-chest-open {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(-120deg); }
        }
        @keyframes mba-reward-pop {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes mba-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* ─── Star particles ─── */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.x,
            top: p.y,
            fontSize: p.size,
            pointerEvents: 'none',
            zIndex: 9999,
            // @ts-expect-error CSS custom properties
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animation: `mba-particle ${p.duration}ms ease-out ${p.delay}ms forwards`,
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* ─── Score floats ─── */}
      {scores.map((s) => (
        <div
          key={s.id}
          style={{
            position: 'fixed',
            left: s.x,
            top: s.y - 20,
            fontSize: 22,
            fontWeight: 800,
            color: '#FFD86B',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            zIndex: 9999,
            animation: 'mba-float-up 1.2s ease-out forwards',
          }}
        >
          {s.text}
        </div>
      ))}

      {/* ─── Celebration overlay ─── */}
      {celeb && <CelebrationOverlay level={celeb.level} key={celeb.id} />}

      {/* ─── Chest overlay ─── */}
      {chest && (
        <ChestOverlay
          rarity={chest.rarity}
          reward={chest.reward}
          phase={chest.phase}
          key={chest.id}
        />
      )}
    </AnimationContext.Provider>
  )
}

/* ─── Celebration sub-component ─── */

function CelebrationOverlay({ level }: { level: CelebLevel }) {
  const isLegendary = level === 'legendary'
  const isBig = level === 'big' || isLegendary
  const isMedium = level === 'medium' || isBig

  const starCount = isLegendary ? 60 : isBig ? 35 : isMedium ? 20 : 0
  const catEmoji = isLegendary ? '🐈' : '😺'

  // 煙火只在 legendary
  const fireworkCount = isLegendary ? 8 : 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: isLegendary ? 'auto' : 'none',
        zIndex: 9990,
        overflow: 'hidden',
      }}
      onClick={isLegendary ? (e) => e.stopPropagation() : undefined}
    >
      {/* 半透明背景（big 以上） */}
      {isBig && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: isLegendary
              ? 'radial-gradient(ellipse at center, rgba(255,140,66,0.3) 0%, rgba(11,16,32,0.85) 70%)'
              : 'radial-gradient(ellipse at center, rgba(160,96,255,0.2) 0%, rgba(11,16,32,0.6) 70%)',
          }}
        />
      )}

      {/* 星星雨 */}
      {Array.from({ length: starCount }, (_, i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 2
        const duration = 1.5 + Math.random() * 2
        const size = 14 + Math.random() * 18
        const emojis = ['⭐', '✨', '🌟', '💫', '🌠']
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: -30,
              fontSize: size,
              animation: `mba-rain ${duration}s ease-in ${delay}s forwards`,
              pointerEvents: 'none',
            }}
          >
            {emojis[i % emojis.length]}
          </div>
        )
      })}

      {/* 煙火（legendary） */}
      {Array.from({ length: fireworkCount }, (_, i) => {
        const left = 10 + Math.random() * 80
        const top = 10 + Math.random() * 50
        const delay = Math.random() * 3
        const hue = Math.random() * 360
        return (
          <div
            key={`fw-${i}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: `radial-gradient(circle, hsla(${hue},100%,70%,0.8) 0%, transparent 70%)`,
              animation: `mba-firework 1.5s ease-out ${delay}s forwards`,
              pointerEvents: 'none',
            }}
          />
        )
      })}

      {/* 貓咪（medium 以上） */}
      {isMedium && (
        <div
          style={{
            position: 'absolute',
            bottom: isLegendary ? '15%' : '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: isLegendary ? 80 : isBig ? 64 : 48,
            animation: isLegendary
              ? 'mba-cat-bounce 0.8s ease-out forwards, mba-cat-dance 1.2s ease-in-out 0.8s infinite'
              : 'mba-cat-bounce 0.8s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9991,
          }}
        >
          {catEmoji}
        </div>
      )}

      {/* legendary 文字 */}
      {isLegendary && (
        <div
          style={{
            position: 'absolute',
            top: '22%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 36,
            fontWeight: 900,
            color: '#FF8C42',
            textShadow: '0 0 20px rgba(255,140,66,0.6), 0 4px 12px rgba(0,0,0,0.5)',
            textAlign: 'center',
            animation: 'mba-reward-pop 0.6s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9992,
            background: 'linear-gradient(90deg, #FFD86B, #FF8C42, #FFD86B)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animationName: 'mba-reward-pop, mba-shimmer',
            animationDuration: '0.6s, 2s',
            animationTimingFunction: 'ease-out, linear',
            animationDelay: '0s, 0.6s',
            animationIterationCount: '1, infinite',
            animationFillMode: 'forwards, none',
          }}
        >
          🎉 成交！🎉
        </div>
      )}

      {/* big 文字（委託/收斡） */}
      {isBig && !isLegendary && (
        <div
          style={{
            position: 'absolute',
            top: '28%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 28,
            fontWeight: 800,
            color: '#A060FF',
            textShadow: '0 0 16px rgba(160,96,255,0.5)',
            animation: 'mba-reward-pop 0.5s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9992,
          }}
        >
          🎊 太厲害了！
        </div>
      )}

      {/* medium 文字（找到人了） */}
      {isMedium && !isBig && (
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 24,
            fontWeight: 700,
            color: '#4A9EFF',
            textShadow: '0 0 12px rgba(74,158,255,0.4)',
            animation: 'mba-reward-pop 0.5s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9992,
          }}
        >
          找到人了！🎯
        </div>
      )}
    </div>
  )
}

/* ─── Chest sub-component ─── */

function ChestOverlay({
  rarity,
  reward,
  phase,
}: {
  rarity: ChestRarity
  reward: number
  phase: 'glow' | 'open' | 'reveal' | 'done'
}) {
  const cfg = RARITY_CONFIG[rarity]
  const isHigh = ['legendary', 'mythic', 'divine', 'eternal'].includes(rarity)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,16,32,0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9995,
        pointerEvents: 'auto',
      }}
    >
      {/* 寶箱 */}
      <div
        style={{
          fontSize: phase === 'reveal' ? 72 : 64,
          // @ts-expect-error CSS custom property
          '--glow-color': cfg.glow,
          animation:
            phase === 'glow'
              ? 'mba-glow-pulse 0.8s ease-in-out infinite'
              : phase === 'open'
                ? 'mba-chest-open 0.6s ease-out forwards'
                : undefined,
          transition: 'font-size 0.3s',
        }}
      >
        {phase === 'reveal' ? '🎁' : '📦'}
      </div>

      {/* 稀有度標籤 */}
      {phase === 'reveal' && (
        <div
          style={{
            marginTop: 16,
            fontSize: 14,
            fontWeight: 600,
            color: cfg.color,
            textTransform: 'uppercase',
            letterSpacing: 2,
            animation: 'mba-reward-pop 0.4s ease-out forwards',
          }}
        >
          {cfg.label}
        </div>
      )}

      {/* 分數 */}
      {phase === 'reveal' && (
        <div
          style={{
            marginTop: 12,
            fontSize: isHigh ? 42 : 32,
            fontWeight: 900,
            color: cfg.color,
            textShadow: `0 0 20px ${cfg.glow}`,
            animation: 'mba-reward-pop 0.5s ease-out 0.2s forwards',
            opacity: 0,
          }}
        >
          +{reward.toLocaleString()}
        </div>
      )}

      {/* 高稀有度粒子 */}
      {phase === 'reveal' &&
        Array.from({ length: cfg.particleCount }, (_, i) => {
          const angle = (i / cfg.particleCount) * Math.PI * 2
          const dist = 60 + Math.random() * 60
          const dx = Math.cos(angle) * dist
          const dy = Math.sin(angle) * dist
          const size = 10 + Math.random() * 14
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: '45%',
                fontSize: size,
                pointerEvents: 'none',
                // @ts-expect-error CSS custom properties
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
                animation: `mba-particle 1s ease-out ${0.1 + Math.random() * 0.3}s forwards`,
              }}
            >
              {['⭐', '✨', '🌟', '💫'][i % 4]}
            </div>
          )
        })}
    </div>
  )
}
