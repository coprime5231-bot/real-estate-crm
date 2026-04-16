import { pool, currentQuarter } from './db'

export type ChestRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'divine'
  | 'eternal'

interface ChestTier {
  reward: number
  rarity: ChestRarity
  cumProb: number
}

// 機率表（cumulative probability）
// 2026-04-16 v2：高稀有度機率上調，eternal 0.3%（一季有機會抽到）
const CHEST_TABLE: ChestTier[] = [
  { reward: 100, rarity: 'common', cumProb: 0.502 },
  { reward: 300, rarity: 'uncommon', cumProb: 0.782 },
  { reward: 500, rarity: 'rare', cumProb: 0.882 },
  { reward: 800, rarity: 'epic', cumProb: 0.932 },
  { reward: 1200, rarity: 'legendary', cumProb: 0.972 },
  { reward: 2000, rarity: 'mythic', cumProb: 0.987 },
  { reward: 5000, rarity: 'divine', cumProb: 0.997 },
  { reward: 10000, rarity: 'eternal', cumProb: 1.0 },
]

function rollChest(): ChestTier {
  const r = Math.random()
  for (const tier of CHEST_TABLE) {
    if (r < tier.cumProb) return tier
  }
  return CHEST_TABLE[CHEST_TABLE.length - 1]
}

export async function getStarBalance(quarter?: string): Promise<{
  stars: number
  chestsAvailable: number
}> {
  const q = quarter ?? currentQuarter()

  const [starsRes, chestsRes] = await Promise.all([
    pool.query(
      'SELECT COALESCE(SUM(stars_awarded), 0)::int AS total FROM task_completions WHERE quarter = $1',
      [q],
    ),
    pool.query(
      'SELECT COUNT(*)::int AS cnt FROM chest_opens WHERE quarter = $1',
      [q],
    ),
  ])

  const totalStars: number = starsRes.rows[0].total
  const chestCount: number = chestsRes.rows[0].cnt
  const stars = totalStars - chestCount * 10
  const chestsAvailable = Math.floor(stars / 10)

  return { stars, chestsAvailable }
}

export async function openChest(quarter?: string): Promise<{
  ok: boolean
  reward: number
  rarity: ChestRarity
  stars: number
  chestsAvailable: number
} | { ok: false; reason: string }> {
  const q = quarter ?? currentQuarter()

  const balance = await getStarBalance(q)
  if (balance.stars < 10) {
    return { ok: false, reason: 'not_enough_stars' }
  }

  const tier = rollChest()

  await pool.query(
    `INSERT INTO chest_opens (stars_cost, reward_score, rarity, quarter)
     VALUES ($1, $2, $3, $4)`,
    [10, tier.reward, tier.rarity, q],
  )

  const after = await getStarBalance(q)

  return {
    ok: true,
    reward: tier.reward,
    rarity: tier.rarity,
    stars: after.stars,
    chestsAvailable: after.chestsAvailable,
  }
}
