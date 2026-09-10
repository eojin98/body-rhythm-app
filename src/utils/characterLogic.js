// Pure functions for character state — import these anywhere including tests

function dateKey(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function recordRate(record) {
  if (!record?.routines) return null
  const entries = Object.values(record.routines)
  if (!entries.length) return null
  const done = entries.filter(r => r?.status === 'done').length
  return done / entries.length
}

// ─── Core metrics ─────────────────────────────────────────────────────────────

export function getTotalDone(records) {
  let total = 0
  for (const record of Object.values(records)) {
    if (record?.routines) {
      total += Object.values(record.routines).filter(r => r?.status === 'done').length
    }
  }
  return total
}

export function getTodayScore(records) {
  const rate = recordRate(records[dateKey(0)])
  return rate === null ? 0 : Math.round(rate * 100)
}

export function getWeekAvgScore(records) {
  const scores = []
  for (let i = 0; i < 7; i++) {
    const rate = recordRate(records[dateKey(i)])
    if (rate !== null) scores.push(rate * 100)
  }
  if (!scores.length) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

// Consecutive days with ≥50% done rate (today is skipped if no data yet)
export function getCurrentStreak(records) {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const rate = recordRate(records[dateKey(i)])
    if (rate === null) {
      if (i === 0) continue
      break
    }
    if (rate >= 0.5) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

// Weighted condition score (0–100)
export function getConditionScore(records) {
  const todayScore = getTodayScore(records)
  const weekAvg = getWeekAvgScore(records)
  const streak = getCurrentStreak(records)
  const total = getTotalDone(records)

  const streakScore = Math.min(100, (streak / 30) * 100)
  const totalScore = Math.min(100, (total / 200) * 100)

  return Math.round(todayScore * 0.4 + weekAvg * 0.3 + streakScore * 0.2 + totalScore * 0.1)
}

// ─── Mood levels (상태, 3단계) ──────────────────────────────────────────────────
// 구간 경계값은 이 배열 한 곳에서만 관리한다.
export const MOODS = [
  { mood: 1, minScore: 70, label: '활발', message: '오늘도 팔팔해요! 이 페이스를 유지해요' },
  { mood: 2, minScore: 40, label: '보통', message: '나쁘지 않아요. 오늘 하나만 더 해볼까요?' },
  { mood: 3, minScore: 0,  label: '지침', message: '조금 지친 것 같아요. 쉬어도 괜찮아요' },
]

export function getMood(score) {
  return (MOODS.find(m => score >= m.minScore) ?? MOODS[MOODS.length - 1]).mood
}

// ─── Growth stages (성장 단계, 5단계) ───────────────────────────────────────────
// 임계값은 이 배열 한 곳에서만 관리한다. 기준: pointLedger.getTotalPoints()의 누적 포인트.
export const GROWTH_STAGES = [
  { stage: 1, minPoints: 0 },
  { stage: 2, minPoints: 150 },
  { stage: 3, minPoints: 500 },
  { stage: 4, minPoints: 1500 },
  { stage: 5, minPoints: 3500 },
]

export function getStage(totalPoints) {
  const matched = GROWTH_STAGES.filter(s => totalPoints >= s.minPoints)
  return (matched.length ? matched[matched.length - 1] : GROWTH_STAGES[0]).stage
}

export function getStageProgress(totalPoints) {
  const currentStage = getStage(totalPoints)
  const currentDef = GROWTH_STAGES.find(s => s.stage === currentStage)
  const nextDef = GROWTH_STAGES.find(s => s.stage === currentStage + 1)
  if (!nextDef) return { progress: 100, toNext: 0, next: null }
  const from = currentDef.minPoints
  const to = nextDef.minPoints
  const progress = Math.min(100, Math.round(((totalPoints - from) / (to - from)) * 100))
  return { progress, toNext: Math.max(0, to - totalPoints), next: to }
}

// ─── Character image ────────────────────────────────────────────────────────
// characterId(1~4) · stage(1~5) · mood(1~3) 조합의 정적 이미지 경로.
// characterId가 없으면(캐릭터 미선택) null을 반환한다.
export function getCharacterImage(characterId, stage, mood) {
  if (characterId == null) return null
  return `/characters/char${characterId}_s${stage}_m${mood}.webp`
}

// ─── Evolution acknowledgement (localStorage) ─────────────────────────────────

export function getAcknowledgedStage() {
  try {
    return parseInt(localStorage.getItem('bodyrhythm_char_stage') ?? '0', 10)
  } catch {
    return 0
  }
}

export function setAcknowledgedStage(stage) {
  try {
    localStorage.setItem('bodyrhythm_char_stage', String(stage))
  } catch {}
}
