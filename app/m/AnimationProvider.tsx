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

/* ─── Web Audio sound effects ─── */

let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}

function playNote(freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getAudioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

function playNoise(startTime: number, duration: number, volume = 0.08) {
  const ctx = getAudioCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start(startTime)
  source.stop(startTime + duration)
}

function soundCoinCollect() {
  const ctx = getAudioCtx()
  const t = ctx.currentTime
  playNote(880, t, 0.1, 'square', 0.1)
  playNote(1320, t + 0.08, 0.15, 'square', 0.1)
}

function soundMediumCeleb() {
  const ctx = getAudioCtx()
  const t = ctx.currentTime
  // do-mi-sol
  playNote(523, t, 0.25, 'triangle', 0.15)
  playNote(659, t + 0.2, 0.25, 'triangle', 0.15)
  playNote(784, t + 0.4, 0.4, 'triangle', 0.18)
}

function soundBigCeleb() {
  const ctx = getAudioCtx()
  const t = ctx.currentTime
  // 華麗五連音 + reverb feel
  playNote(523, t, 0.2, 'triangle', 0.15)
  playNote(659, t + 0.15, 0.2, 'triangle', 0.15)
  playNote(784, t + 0.3, 0.2, 'triangle', 0.18)
  playNote(1047, t + 0.45, 0.3, 'triangle', 0.2)
  playNote(1319, t + 0.6, 0.6, 'sine', 0.2)
  // reverb tail
  playNote(1319, t + 0.8, 0.5, 'sine', 0.08)
  playNote(1047, t + 1.0, 0.4, 'sine', 0.05)
}

function soundLegendaryCeleb() {
  const ctx = getAudioCtx()
  const t = ctx.currentTime
  // 煙火爆炸
  playNoise(t, 0.5, 0.15)
  playNoise(t + 0.3, 0.4, 0.1)
  // 勝利號角 fanfare
  playNote(523, t + 0.5, 0.3, 'square', 0.12)
  playNote(523, t + 0.8, 0.15, 'square', 0.12)
  playNote(523, t + 1.0, 0.15, 'square', 0.12)
  playNote(659, t + 1.2, 0.4, 'square', 0.14)
  playNote(784, t + 1.6, 0.3, 'triangle', 0.16)
  playNote(1047, t + 1.9, 0.8, 'triangle', 0.2)
  // sustain chord
  playNote(523, t + 2.0, 1.2, 'sine', 0.08)
  playNote(784, t + 2.0, 1.2, 'sine', 0.08)
  playNote(1047, t + 2.0, 1.5, 'sine', 0.1)
  // sparkle tail
  playNote(2093, t + 2.8, 0.3, 'sine', 0.06)
  playNote(2637, t + 3.0, 0.4, 'sine', 0.05)
}

function soundChestGlow() {
  const ctx = getAudioCtx()
  const t = ctx.currentTime
  // 低頻嗡嗡 suspense
  playNote(80, t, 0.8, 'sine', 0.12)
  playNote(120, t + 0.3, 0.6, 'sine', 0.1)
  playNote(160, t + 0.5, 0.5, 'triangle', 0.08)
}

function soundChestReveal(rarity: ChestRarity) {
  const ctx = getAudioCtx()
  const t = ctx.currentTime
  const isHigh = ['legendary', 'mythic', 'divine', 'eternal'].includes(rarity)
  if (isHigh) {
    // 華麗展開音
    playNote(440, t, 0.15, 'triangle', 0.15)
    playNote(554, t + 0.1, 0.15, 'triangle', 0.15)
    playNote(659, t + 0.2, 0.15, 'triangle', 0.18)
    playNote(880, t + 0.3, 0.2, 'triangle', 0.2)
    playNote(1109, t + 0.45, 0.4, 'sine', 0.2)
    playNote(1319, t + 0.6, 0.6, 'sine', 0.18)
    playNoise(t + 0.3, 0.3, 0.06)
  } else {
    // 簡單叮
    playNote(880, t, 0.15, 'sine', 0.15)
    playNote(1320, t + 0.12, 0.3, 'sine', 0.12)
  }
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
    soundCoinCollect()
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

      // 音效
      if (level === 'legendary') soundLegendaryCeleb()
      else if (level === 'big') soundBigCeleb()
      else if (level === 'medium') soundMediumCeleb()
      else soundCoinCollect()

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
    soundChestGlow()
    // glow → open → reveal → done
    setTimeout(() => setChest((c) => c && c.id === id ? { ...c, phase: 'open' } : c), 800)
    setTimeout(() => {
      setChest((c) => c && c.id === id ? { ...c, phase: 'reveal' } : c)
      soundChestReveal(rarity)
    }, 1600)
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

  // 星星雨粒子加倍
  const starCount = isLegendary ? 120 : isBig ? 70 : isMedium ? 40 : 0
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

      {/* 貓咪（medium 以上）— 置中偏下 */}
      {isMedium && (
        <div
          style={{
            position: 'absolute',
            top: '55%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: isLegendary ? 120 : isBig ? 90 : 70,
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

      {/* legendary 文字 — 畫面正中央 */}
      {isLegendary && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 56,
            fontWeight: 900,
            color: '#FF8C42',
            textShadow: '0 0 20px rgba(255,140,66,0.6), 0 4px 12px rgba(0,0,0,0.5)',
            textAlign: 'center',
            animation: 'mba-reward-pop 0.6s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9992,
            width: '50%',
            maxWidth: 400,
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

      {/* big 文字（委託/收斡）— 畫面正中央 */}
      {isBig && !isLegendary && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 42,
            fontWeight: 800,
            color: '#A060FF',
            textShadow: '0 0 16px rgba(160,96,255,0.5)',
            textAlign: 'center',
            animation: 'mba-reward-pop 0.5s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9992,
            width: '50%',
            maxWidth: 360,
          }}
        >
          🎊 太厲害了！
        </div>
      )}

      {/* medium 文字（找到人了）— 畫面正中央 */}
      {isMedium && !isBig && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 36,
            fontWeight: 700,
            color: '#4A9EFF',
            textShadow: '0 0 12px rgba(74,158,255,0.4)',
            textAlign: 'center',
            animation: 'mba-reward-pop 0.5s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 9992,
            width: '50%',
            maxWidth: 320,
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
