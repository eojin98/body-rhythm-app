import { getDeviceId, getTodayKey } from './storage'
import { ALARM_PERIODS, TEST_HOURLY_BEHAVIORS } from './alarmContent'

// ─── Point rules (single source of truth) ────────────────────────────────────

export const POINT_ACTIONS = {
  COMPLETE:    'complete',  // 알람 완료:        1P
  SKIP:        'skip',      // 건너뜀:           0P  (원장에는 기록)
  // 다음 단계에서 추가 예정:
  // DISMISS:     'dismiss',      // 알람 해제:        1P
  // SELF_REPORT: 'self_report',  // 자기보고 완료:    3P
  // TIMER_SHORT: 'timer_short',  // 짧은 타이머 완료: 8P
  // TIMER_BOOST: 'timer_boost',  // 강화모드 타이머:  10P
}

export const POINT_VALUES = {
  [POINT_ACTIONS.COMPLETE]:    1,
  [POINT_ACTIONS.SKIP]:        0,
  // [POINT_ACTIONS.DISMISS]:     1,
  // [POINT_ACTIONS.SELF_REPORT]: 3,
  // [POINT_ACTIONS.TIMER_SHORT]: 8,
  // [POINT_ACTIONS.TIMER_BOOST]: 10,
}

// saveRoutineAction 에서 사용하는 값 → POINT_ACTIONS 매핑
const ROUTINE_TO_ACTION = {
  done:    POINT_ACTIONS.COMPLETE,
  skipped: POINT_ACTIONS.SKIP,
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
 * @param {string} params.date          - 'yyyy-MM-dd'  (네이티브 sync 시 실제 발생일)
 * @param {string} params.alarmId       - periodId ('morning', 'test_09' 등)
 * @param {string} params.routineAction - saveRoutineAction에서 쓰는 값: 'done' | 'skipped'
 *
 * 중복 방지: 같은 (date, alarmId) 조합이 있으면 기존 항목을 갱신(upsert).
 * 예: 건너뜀(0P) 기록 후 완료(1P)로 수정 → 포인트가 1P로 갱신됨.
 */
export function recordPoint({ date, alarmId, routineAction }) {
  const action = ROUTINE_TO_ACTION[routineAction]
  if (!action) return  // 'snooze' 등 매핑 없는 값은 기록하지 않음

  const points    = POINT_VALUES[action]
  const alarmLabel = getLabelForAlarm(alarmId)
  const time      = resolveTimeStr(alarmId)
  const ledger    = getLedger()

  const idx = ledger.findIndex(e => e.date === date && e.alarmId === alarmId)

  const entry = {
    id:         idx >= 0 ? ledger[idx].id : generateId(),
    date,
    time,
    alarmId,
    alarmLabel,
    action,
    points,
    timestamp:  Date.now(),
  }

  if (idx >= 0) {
    ledger[idx] = entry  // 기존 항목 갱신 (예: skip→complete 업그레이드)
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

/** 최근 N개 적립 내역 (최신순) */
export function getRecentEntries(n = 10) {
  return getLedger()
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, n)
}

/** 전체 적립 내역 (최신순) */
export function getAllEntries() {
  return getLedger()
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
}

/** 특정 날짜의 적립 내역 (최신순) */
export function getEntriesByDate(dateKey) {
  return getLedger()
    .filter(e => e.date === dateKey)
    .sort((a, b) => b.timestamp - a.timestamp)
}

/** 원장 전체 삭제 (개발용) */
export function clearLedger() {
  localStorage.removeItem(ledgerKey())
}
