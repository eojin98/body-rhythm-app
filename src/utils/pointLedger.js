import { getDeviceId, getTodayKey } from './storage'
import { ALARM_PERIODS, TEST_HOURLY_BEHAVIORS } from './alarmContent'

// ─── Point rules (single source of truth) ────────────────────────────────────

export const POINT_ACTIONS = {
  NORMAL_COMPLETE:      'normal_complete',       // 일반 알람 완료: 1P
  BOOST_COMPLETE:       'boost_complete',         // 강화모드 즉시 완료: 2P
  BOOST_TIMER_COMPLETE: 'boost_timer_complete',   // 강화모드 타이머 완료: timerSeconds 기준 5/8/10P
  SKIP:                 'skip',                   // 건너뜀: 0P
}

// boost_timer_complete는 timerSeconds에 따라 동적 계산 — null로 표시
export const POINT_VALUES = {
  [POINT_ACTIONS.NORMAL_COMPLETE]:      1,
  [POINT_ACTIONS.BOOST_COMPLETE]:       2,
  [POINT_ACTIONS.BOOST_TIMER_COMPLETE]: null,
  [POINT_ACTIONS.SKIP]:                 0,
}

// timerSeconds 기준: ≤60s → 5P, 61~599s → 8P, ≥600s → 10P
function calcPoints(action, timerSeconds) {
  if (action === POINT_ACTIONS.BOOST_TIMER_COMPLETE) {
    if (timerSeconds >= 600) return 10
    if (timerSeconds >= 61)  return 8
    return 5
  }
  return POINT_VALUES[action] ?? 0
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function ledgerKey() {
  return `${getDeviceId()}_pointLedger`
}

function getLedger() {
  try {
    const raw = localStorage.getItem(ledgerKey())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLedger(ledger) {
  localStorage.setItem(ledgerKey(), JSON.stringify(ledger))
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** alarmId(periodId) → 사람이 읽을 수 있는 알람 이름 */
export function getLabelForAlarm(alarmId) {
  if (!alarmId) return '알람'
  if (alarmId.startsWith('test_')) {
    const hk = alarmId.replace('test_', '')
    return TEST_HOURLY_BEHAVIORS[hk]?.title ?? `${hk}:00 루틴`
  }
  return ALARM_PERIODS[alarmId]?.name ?? alarmId
}

// boost alarmId(test_09) → "09:00", 그 외 → 현재 시각
function resolveTimeStr(alarmId) {
  if (alarmId?.startsWith('test_')) {
    return `${alarmId.replace('test_', '')}:00`
  }
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

// ─── Core: record a point (upsert) ───────────────────────────────────────────

/**
 * 알람 완료·건너뜀 시 포인트 원장에 기록한다.
 *
 * @param {object} params
 * @param {string} params.date           - 'yyyy-MM-dd'  (네이티브 sync 시 실제 발생일)
 * @param {string} params.alarmId        - periodId ('morning', 'test_09' 등)
 * @param {string} params.action         - POINT_ACTIONS 값 중 하나
 * @param {number} [params.timerSeconds] - boost_timer_complete 시 타이머 실행 시간(초)
 *
 * 중복 방지: 같은 (date, alarmId) 조합이 있으면 기존 항목을 갱신(upsert).
 * 예: skip(0P) 기록 후 boost_complete(2P)로 수정 → 포인트가 2P로 갱신됨.
 */
export function recordPoint({ date, alarmId, action, timerSeconds = null, points: pointsOverride = undefined }) {
  if (!(action in POINT_VALUES)) return  // 알 수 없는 action은 무시

  const points = pointsOverride !== undefined ? pointsOverride : calcPoints(action, timerSeconds)
  const alarmLabel = getLabelForAlarm(alarmId)
  const time       = resolveTimeStr(alarmId)
  const ledger     = getLedger()

  const idx = ledger.findIndex(e => e.date === date && e.alarmId === alarmId)

  const entry = {
    id:          idx >= 0 ? ledger[idx].id : generateId(),
    date,
    time:        idx >= 0 ? ledger[idx].time : time,
    alarmId,
    alarmLabel,
    action,
    points,
    timerSeconds,
    timestamp:   Date.now(),
  }

  if (idx >= 0) {
    ledger[idx] = entry  // 기존 항목 갱신 (예: skip→boost_complete 업그레이드)
  } else {
    ledger.push(entry)
  }

  saveLedger(ledger)
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/** 총 누적 포인트 (원장 합산) */
export function getTotalPoints() {
  return getLedger().reduce((sum, e) => sum + (e.points || 0), 0)
}

/** 오늘 획득 포인트 */
export function getTodayPoints() {
  const today = getTodayKey()
  return getLedger()
    .filter(e => e.date === today)
    .reduce((sum, e) => sum + (e.points || 0), 0)
}

function byOccurrenceDesc(a, b) {
  return (`${b.date} ${b.time}`).localeCompare(`${a.date} ${a.time}`)
}

/** 최근 N개 적립 내역 (최신순) */
export function getRecentEntries(n = 10) {
  return getLedger()
    .slice()
    .sort(byOccurrenceDesc)
    .slice(0, n)
}

/** 전체 적립 내역 (최신순) */
export function getAllEntries() {
  return getLedger()
    .slice()
    .sort(byOccurrenceDesc)
}

/** 특정 날짜의 적립 내역 (최신순) */
export function getEntriesByDate(dateKey) {
  return getLedger()
    .filter(e => e.date === dateKey)
    .sort(byOccurrenceDesc)
}

/** 원장 전체 삭제 (개발용) */
export function clearLedger() {
  localStorage.removeItem(ledgerKey())
}
