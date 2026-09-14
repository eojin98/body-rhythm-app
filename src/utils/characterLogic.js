// Pure functions for character state — import these anywhere including tests
import { calculatePracticeRate } from './storage'

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

// ─── Weekly practice rate (mood 기준) ─────────────────────────────────────────

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hasPracticeData(record) {
  return Object.values(record?.routines || {}).some(r => r?.status != null)
}

/**
 * 어제까지 7일(오늘 제외) 실천률 평균(0~100). 집계할 날이 하루도 없으면 null.
 *
 * - 오늘은 제외한다. 알람이 아직 안 울린 시간대에 오늘이 0%로 들어가면 같은 날 안에서도
 *   아침·저녁 mood가 달라져 추세 지표로 쓸 수 없기 때문이다.
 * - 하루 단위 실천률은 storage.calculatePracticeRate(record)를 그대로 쓴다.
 * - 기록이 없는 날은 0%로 센다 (분모는 달력 일수).
 * - 시작일 = max(가입일, 이 기기의 가장 이른 기록일). 시작일 이후가 7일 미만이면
 *   그 일수로만 나눠, 가입 초반이나 새 기기 설치 직후 무조건 '지침'이 되지 않게 한다.
 *   (실천 기록은 기기 로컬 저장이라, 가입일만 쓰면 새 기기에서 빈 날이 0%로 잡힌다)
 * - 가입 당일처럼 시작일이 오늘이라 집계할 어제가 없으면 null을 반환한다.
 *
 * @param {object} records     storage.getRecords() 결과
 * @param {string} [signupAt]  가입 시각 (Supabase user.created_at, ISO 문자열)
 */
export function getWeeklyPracticeRate(records, signupAt = null) {
  const recordKeys = Object.keys(records).filter(k => hasPracticeData(records[k])).sort()
  if (!recordKeys.length) return null

  let startKey = recordKeys[0]
  if (signupAt) {
    const signup = new Date(signupAt)
    if (!Number.isNaN(signup.getTime())) {
      const signupKey = localDateKey(signup)
      if (signupKey > startKey) startKey = signupKey
    }
  }

  let sum = 0
  let days = 0
  for (let i = 1; i <= 7; i++) {   // 어제(i=1)부터 7일 전(i=7)까지
    const key = dateKey(i)
    if (key < startKey) break
    sum += calculatePracticeRate(records[key])
    days++
  }
  if (days === 0) return null
  return Math.round(sum / days)
}

// ─── Mood levels (상태, 3단계) ──────────────────────────────────────────────────
// 기준: 어제까지 7일 실천률(%). 구간 경계값은 이 배열 한 곳에서만 관리한다.
export const MOODS = [
  { mood: 1, minRate: 70, label: '활발', message: '최근 일주일 꾸준했어요! 이 페이스를 유지해요' },
  { mood: 2, minRate: 50, label: '보통', message: '나쁘지 않아요. 조금만 더 꾸준해져 볼까요?' },
  { mood: 3, minRate: 0,  label: '지침', message: '요즘 조금 지친 것 같아요. 하나씩 다시 시작해봐요' },
]

/** @param {number|null} weeklyRate getWeeklyPracticeRate() 결과. null(집계할 날 없음)이면 보통(2). */
export function getMood(weeklyRate) {
  if (weeklyRate == null) return 2
  return (MOODS.find(m => weeklyRate >= m.minRate) ?? MOODS[MOODS.length - 1]).mood
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
