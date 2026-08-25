import { getTodayKey } from './storage'
import { ALARM_PERIODS, TEST_HOURLY_BEHAVIORS } from './alarmContent'

// ─── 현재 로그인한 user_id (AuthContext가 로그인/로그아웃 시 세팅) ──────────────
let _currentUserId = null

/**
 * 현재 로그인한 user_id를 주입한다. AuthContext의 onAuthStateChange에서 호출.
 * React 렌더 전에 동기적으로 세팅되어, 컴포넌트가 pointLedger를 읽을 때
 * 올바른 user_id의 원장을 읽게 된다.
 */
export function setCurrentUser(uid) {
  _currentUserId = uid ?? null
}

// ─── 정책 상수 (단일 출처) ───────────────────────────────────────────────────

/** 최초 발화 시각으로부터 이 시간 이내 반응해야 포인트 지급 */
export const POINT_POLICY = {
  REACTION_DEADLINE_MS: 15 * 60 * 1000,   // 15분
}

// ─── 포인트 규칙 (단일 출처) ─────────────────────────────────────────────────

export const POINT_ACTIONS = {
  NORMAL_COMPLETE:      'normal_complete',       // 일반 알람 완료: 1P
  BOOST_COMPLETE:       'boost_complete',         // 강화모드 즉시 완료: 2P
  BOOST_TIMER_COMPLETE: 'boost_timer_complete',   // 강화모드 타이머 완료: 5/8/10P
  SKIP:                 'skip',                   // 건너뜀: 0P (원장 미기록)
}

// 포인트 값 상수 (타이머는 구간별 동적 계산 → null)
const P = {
  NORMAL:        1,
  BOOST:         2,
  TIMER_SHORT:   5,    // ≤60s
  TIMER_MEDIUM:  8,    // 61–599s
  TIMER_FULL:   10,    // ≥600s (10분)
  TIMER_FULL_MIN_S:   600,
  TIMER_MEDIUM_MIN_S:  61,
}

export const POINT_VALUES = {
  [POINT_ACTIONS.NORMAL_COMPLETE]:      P.NORMAL,
  [POINT_ACTIONS.BOOST_COMPLETE]:       P.BOOST,
  [POINT_ACTIONS.BOOST_TIMER_COMPLETE]: null,
  [POINT_ACTIONS.SKIP]:                 0,
}

// timerSeconds 기준: ≤60s → 5P, 61–599s → 8P, ≥600s → 10P
function calcPoints(action, timerSeconds) {
  if (action === POINT_ACTIONS.BOOST_TIMER_COMPLETE) {
    if (timerSeconds >= P.TIMER_FULL_MIN_S)   return P.TIMER_FULL
    if (timerSeconds >= P.TIMER_MEDIUM_MIN_S) return P.TIMER_MEDIUM
    return P.TIMER_SHORT
  }
  return POINT_VALUES[action] ?? 0
}

// ─── Storage (user_id별 분리) ─────────────────────────────────────────────────

// 키: pointLedger_{userId}  — user_id가 없으면 null (읽기/쓰기 모두 no-op)
function ledgerKey() {
  return _currentUserId ? `pointLedger_${_currentUserId}` : null
}

function getLedger() {
  const key = ledgerKey()
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLedger(ledger) {
  const key = ledgerKey()
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ledger))
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

// ─── Core: record a point ────────────────────────────────────────────────────

/**
 * 알람 완료 시 포인트 원장에 기록한다.
 *
 * @param {object} params
 * @param {string} params.date            - 'yyyy-MM-dd' (실제 알람 발화 날짜)
 * @param {string} params.alarmId         - periodId ('morning', 'test_09' 등)
 * @param {string} params.action          - POINT_ACTIONS 값 중 하나
 * @param {number} [params.timerSeconds]  - boost_timer_complete 시 타이머 실행 시간(초)
 * @param {number} [params.points]        - 직접 지정 시 calcPoints 우선 덮어씀 (0이면 미기록)
 * @param {string|null} [params.occurrenceId] - 강화알람 회차 ID (없으면 date+alarmId로 중복 판정)
 *
 * 정책:
 * - 0P는 원장에 기록하지 않음 (policy 4)
 * - occurrenceId(또는 date+alarmId)가 이미 원장에 있으면 재기록하지 않음 (policy 5)
 */
export function recordPoint({ date, alarmId, action, timerSeconds = null, points: pointsOverride = undefined, occurrenceId = null }) {
  // 로그인 안 된 상태에서는 포인트 미기록 (알람 동작은 정상, 포인트만 건너뜀)
  if (!_currentUserId) return
  if (!(action in POINT_VALUES)) return

  const points = pointsOverride !== undefined ? pointsOverride : calcPoints(action, timerSeconds)

  // Policy 4: 0P는 원장 미기록 (건너뜀·지각완료 등)
  if (points === 0) return

  const ledger = getLedger()

  // Policy 5: 회차당 1회 지급 (occurrenceId 우선, fallback: date+alarmId)
  const alreadyExists = occurrenceId
    ? ledger.some(e => e.occurrenceId === occurrenceId)
    : ledger.some(e => e.date === date && e.alarmId === alarmId)
  if (alreadyExists) return

  ledger.push({
    id: generateId(),
    date,
    time: resolveTimeStr(alarmId),
    alarmId,
    alarmLabel: getLabelForAlarm(alarmId),
    action,
    points,
    timerSeconds,
    occurrenceId,
    timestamp: Date.now(),
    synced: false,
  })

  saveLedger(ledger)

  // 포인트 기록 직후 sync 트리거 (App.jsx에서 구독)
  try { window.dispatchEvent(new CustomEvent('bodyrhythm:pointRecorded')) } catch {}
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
  const key = ledgerKey()
  if (key) localStorage.removeItem(key)
}

// ─── Server merge (pointSync.js에서 사용) ─────────────────────────────────────

/**
 * 서버에서 조회한 포인트 트랜잭션 행을 로컬 원장에 병합한다.
 * - occurrence_id 기준 중복 제거
 * - 이미 로컬에 있는 항목은 건드리지 않음
 * - 새 항목이 추가된 경우 bodyrhythm:ledgerUpdated 이벤트 발행 (UI 갱신)
 */
export function mergeEntriesFromServer(serverRows) {
  if (!serverRows || serverRows.length === 0 || !_currentUserId) return
  const ledger = getLedger()

  let added = 0
  for (const row of serverRows) {
    if (_isDuplicate(row, ledger)) continue
    ledger.push({
      id: generateId(),
      date: row.date,
      time: resolveTimeStr(row.alarm_id),
      alarmId: row.alarm_id,
      alarmLabel: getLabelForAlarm(row.alarm_id),
      action: row.action,
      points: row.points,
      timerSeconds: null,
      occurrenceId: row.occurrence_id,
      timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      synced: true,
    })
    added++
  }

  if (added > 0) {
    saveLedger(ledger)
    try { window.dispatchEvent(new CustomEvent('bodyrhythm:ledgerUpdated')) } catch {}
  }
  return added
}

function _isDuplicate(row, ledger) {
  const sid = row.occurrence_id
  // 1. occurrenceId 직접 일치 (강화알람 UUID 또는 이미 병합된 "date__alarmId")
  if (ledger.some(e => e.occurrenceId === sid)) return true
  // 2. "date__alarmId" 형식 → 로컬의 occurrenceId=null 항목과 date+alarmId로 비교
  if (sid && sid.includes('__')) {
    const sep = sid.indexOf('__')
    const sDate = sid.slice(0, sep)
    const sAlarmId = sid.slice(sep + 2)
    if (ledger.some(e => !e.occurrenceId && e.date === sDate && e.alarmId === sAlarmId)) return true
  }
  return false
}

// ─── Sync helpers (pointSync.js에서 사용) ────────────────────────────────────

/** 아직 서버에 올라가지 않은 원장 항목 목록 */
export function getUnsyncedEntries() {
  return getLedger().filter(e => !e.synced)
}

/** ids 에 해당하는 항목을 synced: true 로 표시 */
export function markEntriesSynced(ids) {
  const set = new Set(ids)
  const ledger = getLedger()
  let changed = false
  for (const e of ledger) {
    if (set.has(e.id) && !e.synced) {
      e.synced = true
      changed = true
    }
  }
  if (changed) saveLedger(ledger)
}
