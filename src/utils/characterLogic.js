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

// ─── Condition levels ─────────────────────────────────────────────────────────

export const CONDITIONS = [
  { minScore: 85, level: 'excellent', label: '최상', emoji: '✨', message: '오늘도 완벽해요! 바디가 신나있어요' },
  { minScore: 65, level: 'good',      label: '좋음', emoji: '😸', message: '컨디션이 좋아요. 이 페이스 유지해요!' },
  { minScore: 45, level: 'normal',    label: '보통', emoji: '😺', message: '나쁘지 않아요. 오늘 하나만 더 해볼까요?' },
  { minScore: 25, level: 'low',       label: '낮음', emoji: '😿', message: '조금 지친 것 같아요. 쉬어도 괜찮아요' },
  { minScore: 0,  level: 'rest',      label: '휴식', emoji: '😴', message: '바디가 기다리고 있어요. 오늘부터 다시 시작!' },
]

export function getCondition(conditionScore) {
  return CONDITIONS.find(c => conditionScore >= c.minScore) ?? CONDITIONS[CONDITIONS.length - 1]
}

// ─── Evolution stages ─────────────────────────────────────────────────────────

export const EVOLUTION_STAGES = [
  { minTotal: 100, stage: 2, name: '바디 맥스', emoji: '🐈‍⬛', badge: '👑', description: '전설의 고양이로 진화했어요!' },
  { minTotal: 30,  stage: 1, name: '바디',      emoji: '🐈',   badge: '⭐', description: '성장하고 있는 바디예요' },
  { minTotal: 0,   stage: 0, name: '아기 바디', emoji: '🐱',   badge: '',   description: '이제 막 태어난 바디예요' },
]

export function getEvolutionStage(totalDone) {
  return EVOLUTION_STAGES.find(s => totalDone >= s.minTotal) ?? EVOLUTION_STAGES[EVOLUTION_STAGES.length - 1]
}

export function getEvolutionProgress(totalDone) {
  const thresholds = [0, 30, 100]
  const idx = totalDone >= 100 ? 2 : totalDone >= 30 ? 1 : 0
  if (idx === 2) return { progress: 100, current: totalDone, next: null, toNext: 0 }
  const from = thresholds[idx]
  const to = thresholds[idx + 1]
  const progress = Math.min(100, Math.round(((totalDone - from) / (to - from)) * 100))
  return { progress, current: totalDone, next: to, toNext: to - totalDone }
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
