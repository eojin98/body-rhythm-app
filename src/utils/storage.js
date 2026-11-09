// 설정 마이그레이션 키 (migrateSettings). 화면 표시용 버전은 utils/appInfo.js — 이 값은 앱 버전과 맞추지 않는다
export const APP_VERSION = '1.1.0'

const DEVICE_ID_KEY = 'bodyrhythm_device_id'

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36)
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function keys() {
  const id = getDeviceId()
  return {
    settings: `${id}_settings`,
    records: `${id}_records`,
    notifLog: `${id}_notif_log`,
    snooze: `${id}_snooze`,
    alarmPlans: `${id}_alarm_plans`,
    recordRulesSince: `${id}_record_rules_since`,
  }
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

export { DAY_NAMES }

const DEFAULT_ALARMS = [
  { id: 1, type: 'morning',   name: '아침 루틴', time: '07:30', days: [0,1,2,3,4,5,6], enabled: true, icon: '🌅' },
  { id: 2, type: 'afternoon', name: '오후 루틴', time: '13:30', days: [0,1,2,3,4,5,6], enabled: true, icon: '☀️' },
  { id: 3, type: 'evening',   name: '저녁 루틴', time: '18:30', days: [1,2,3,4,5],     enabled: true, icon: '🌆' },
  { id: 4, type: 'bedtime',   name: '취침 준비', time: '22:30', days: [0,1,2,3,4,5,6], enabled: true, icon: '🌙' },
]

const DEFAULT_SETTINGS = {
  onboardingComplete: false,
  wakeTime: '07:00',
  sleepTime: '23:00',
  alarms: DEFAULT_ALARMS,
  behaviors: {},
  testMode: false,
  alarmSoundMode: 'system', // 'system' | 'sound' | 'vibrate'
  notificationsEnabled: true,
  hourlyAlarmSettings: {}, // { [hk: '07'~'23']: { enabled: boolean, boostMode: boolean } }
  appVersion: APP_VERSION,
}

function migrateSettings(settings) {
  if (settings.appVersion === APP_VERSION) return settings
  return {
    ...settings,
    behaviors: settings.behaviors || {},
    appVersion: APP_VERSION,
  }
}

export function getSettings() {
  try {
    const data = localStorage.getItem(keys().settings)
    if (!data) return { ...DEFAULT_SETTINGS, alarms: [...DEFAULT_ALARMS] }
    const saved = JSON.parse(data)
    // Migrate old food-based alarms to new behavior-based alarms
    const needsAlarmMigration = !saved.alarms?.length || saved.alarms.some(a => !a.type)
    if (needsAlarmMigration) {
      const migrated = { ...DEFAULT_SETTINGS, ...saved, alarms: [...DEFAULT_ALARMS] }
      saveSettings(migrated)
      return migrated
    }
    const migrated = migrateSettings(saved)
    if (migrated !== saved) saveSettings(migrated)
    const result = { ...DEFAULT_SETTINGS, ...migrated }
    // Ensure hourlyAlarmSettings always exists (migration for pre-existing saves)
    if (!result.hourlyAlarmSettings) result.hourlyAlarmSettings = {}
    // Migrate old 'silent' soundMode (removed) → 'system'
    if (result.alarmSoundMode === 'silent') result.alarmSoundMode = 'system'
    return result
  } catch {
    return { ...DEFAULT_SETTINGS, alarms: [...DEFAULT_ALARMS] }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(keys().settings, JSON.stringify(settings))
  // 그날 알람 목록(recordReconcile)이 바뀐 설정을 바로 반영하도록 알린다
  try { window.dispatchEvent(new CustomEvent('bodyrhythm:settingsChanged')) } catch {}
}

export function getRecords() {
  try {
    const data = localStorage.getItem(keys().records)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function notifyRecordsChanged() {
  try { window.dispatchEvent(new CustomEvent('bodyrhythm:recordsChanged')) } catch {}
}

export function saveRecord(date, record) {
  const records = getRecords()
  records[date] = { ...records[date], ...record }
  localStorage.setItem(keys().records, JSON.stringify(records))
  notifyRecordsChanged()
}

export function getRecord(date) {
  const records = getRecords()
  return records[date] || null
}

export function getTodayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  const day = DAY_NAMES[date.getDay()]
  return `${y}년 ${Number(m)}월 ${Number(d)}일 (${day})`
}

// Count a meal as eaten regardless of old format (boolean) or new format ({ skipped, time })
function isMealEaten(meal) {
  if (meal == null) return false
  if (typeof meal === 'boolean') return meal
  return !meal.skipped
}

// ─── 하루 실천률 (하루 알람 목록 기준) ───────────────────────────────────────
// 칸 = 기록된 칸(완료·건너뜀·미실행) + 그날 목록에서 대상인 칸. 오늘은 이미 울린 칸까지만.
// 꺼둔 알람은 목록에 없으므로 분모에서 빠진다. 목록이 없는 날(새 규칙 적용 전)은 기록된 칸만 센다.
const PRACTICE_STATUSES = ['done', 'skipped', 'missed']

/**
 * 그날 실천률을 셀 칸 목록. [{ id, status }] — status null = 이미 울렸지만 아직 응답·확정 전(응답 대기).
 * 기록 탭 하루 상세의 목록·개수와 calculateDayPracticeRate가 모두 이 목록을 쓴다.
 */
export function getDayPracticeCells(dateKey, record, now = new Date()) {
  const cells = new Map()
  for (const [id, v] of Object.entries(record?.routines ?? {})) {
    if (PRACTICE_STATUSES.includes(v?.status)) cells.set(id, v.status)
  }
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMin = now.getHours() * 60 + now.getMinutes()
  for (const e of getAlarmPlans()[dateKey] ?? []) {
    if (!isPlanEntryLive(e)) continue
    if (dateKey === todayKey && e.ringMin > nowMin) continue   // 오늘, 아직 안 울린 칸
    if (!cells.has(e.id)) cells.set(e.id, null)
  }
  return [...cells].map(([id, status]) => ({ id, status }))
}

/** 그날 실천률(0~100) = 완료 칸 / 셀 칸. 셀 칸이 하나도 없으면 null. 앱 전체의 하루 실천률은 이 함수 하나로 계산한다. */
export function calculateDayPracticeRate(dateKey, record, now = new Date()) {
  const cells = getDayPracticeCells(dateKey, record, now)
  if (!cells.length) return null
  const done = cells.filter(c => c.status === 'done').length
  return Math.round((done / cells.length) * 100)
}

// 홈·캐릭터 '오늘 실천율' (이미 울린 알람 기준)
export function calculateTodayPracticeRate(record) {
  return calculateDayPracticeRate(getTodayKey(), record) ?? 0
}

export function getLastWeekDates() {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = DAY_NAMES[d.getDay()]
    dates.push({ key, label, date: d })
  }
  return dates
}

export function getNotifLog() {
  try {
    const data = localStorage.getItem(keys().notifLog)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function markNotifFired(alarmId, minuteKey) {
  const log = getNotifLog()
  log[`${alarmId}_${minuteKey}`] = true
  // Keep log small - only last 100 entries
  const logKeys = Object.keys(log)
  if (logKeys.length > 100) {
    const toDelete = logKeys.slice(0, logKeys.length - 100)
    toDelete.forEach(k => delete log[k])
  }
  localStorage.setItem(keys().notifLog, JSON.stringify(log))
}

export function wasNotifFired(alarmId, minuteKey) {
  const log = getNotifLog()
  return !!log[`${alarmId}_${minuteKey}`]
}

export function getNextAlarm(alarms) {
  const now = new Date()
  const currentDay = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const enabled = alarms.filter(a => a.enabled)

  for (let offset = 0; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7
    const dayAlarms = enabled
      .filter(a => a.days.includes(checkDay))
      .map(a => {
        const [h, m] = a.time.split(':').map(Number)
        return { ...a, totalMins: h * 60 + m }
      })
      .filter(a => offset > 0 || a.totalMins > currentMinutes)
      .sort((a, b) => a.totalMins - b.totalMins)

    if (dayAlarms.length > 0) {
      return { ...dayAlarms[0], daysFromNow: offset }
    }
  }
  return null
}

export function timeUntil(alarmTime, daysFromNow = 0) {
  const now = new Date()
  const [h, m] = alarmTime.split(':').map(Number)
  const target = new Date()
  target.setDate(target.getDate() + daysFromNow)
  target.setHours(h, m, 0, 0)

  const diffMs = target - now
  if (diffMs < 0) return null

  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}분 후`
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (mins === 0) return `${hours}시간 후`
  return `${hours}시간 ${mins}분 후`
}

export function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hour}:${String(m).padStart(2, '0')}`
}

// --- Checkin prompt status (completed / skipped / null per day) ---
// Key format: `${deviceId}_checkin_${dateKey}` (e.g. checkin_2026-04-21)

export function getCheckinStatus(dateKey) {
  if (getRecord(dateKey)?.completed) return 'completed'
  try {
    const id = getDeviceId()
    return localStorage.getItem(`${id}_checkin_${dateKey}`) || null
  } catch {
    return null
  }
}

export function setCheckinSkipped(dateKey) {
  try {
    const id = getDeviceId()
    localStorage.setItem(`${id}_checkin_${dateKey}`, 'skipped')
  } catch {}
}

// --- Routine actions (완료/건너뛰기 per period per day) ---

// 한번 기록된 칸은 바꾸지 않는다(먼저 기록된 값이 최종).
// 응답 시각이 그날 알람 목록의 확정 시점 이후면 늦은 응답이므로 'missed'로 기록한다.
// 반환값: 실제로 기록한 상태. 이미 기록돼 있던 칸이면 null.
export function saveRoutineAction(dateKey, periodId, status, respondedAtMs = Date.now()) {
  const records = getRecords()
  const record = records[dateKey] || {}
  if (record.routines?.[periodId]?.status) return null
  const finalStatus = isAfterDeadline(dateKey, periodId, respondedAtMs) ? 'missed' : status
  records[dateKey] = {
    ...record,
    routines: {
      ...record.routines,
      [periodId]: { status: finalStatus, updatedAt: new Date().toISOString() },
    },
  }
  localStorage.setItem(keys().records, JSON.stringify(records))
  notifyRecordsChanged()
  return finalStatus
}

/** 목록에 들어온 뒤에 울리는 칸만 미실행 확정·늦은 응답 판정 대상이다. */
export function isPlanEntryLive(entry) {
  return entry.ringMin >= entry.sinceMin
}

// 그날 목록에 없거나 대상이 아닌 칸에 대한 응답은 그대로 기록한다(거부·변환하지 않음)
function isAfterDeadline(dateKey, periodId, respondedAtMs) {
  const entry = getAlarmPlans()[dateKey]?.find(e => e.id === periodId)
  if (!entry || !isPlanEntryLive(entry)) return false
  const t = new Date(respondedAtMs)
  const respondedKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  if (respondedKey !== dateKey) return respondedKey > dateKey
  return t.getHours() * 60 + t.getMinutes() >= entry.deadlineMin
}

// --- Snooze state (나중에 — temporary, not stored in daily records) ---

export function getSnooze(periodId) {
  try {
    const data = JSON.parse(localStorage.getItem(keys().snooze) || '{}')
    return data[periodId] || null
  } catch {
    return null
  }
}

export function setSnooze(periodId, untilMs) {
  try {
    const data = JSON.parse(localStorage.getItem(keys().snooze) || '{}')
    data[periodId] = untilMs
    localStorage.setItem(keys().snooze, JSON.stringify(data))
  } catch {}
}

// 미실행 일괄 기록 (recordReconcile에서 사용). 비어 있는 칸에만 쓴다.
// idsByDate: { 'yyyy-MM-dd': [alarmId, ...] }
export function markRoutinesMissed(idsByDate) {
  const records = getRecords()
  const updatedAt = new Date().toISOString()
  let changed = false
  for (const [dateKey, ids] of Object.entries(idsByDate)) {
    const rec = records[dateKey] || {}
    const routines = { ...rec.routines }
    for (const id of ids) {
      if (routines[id]?.status) continue
      routines[id] = { status: 'missed', updatedAt }
      changed = true
    }
    records[dateKey] = { ...rec, routines }
  }
  if (changed) {
    localStorage.setItem(keys().records, JSON.stringify(records))
    notifyRecordsChanged()
  }
}

// --- 하루 알람 목록(계획) · 새 기록 규칙 적용 시작일 (recordReconcile에서 사용) ---
// 알람 목록: { 'yyyy-MM-dd': [{ id, ringMin, deadlineMin, sinceMin }] }

export function getAlarmPlans() {
  try {
    return JSON.parse(localStorage.getItem(keys().alarmPlans) || '{}')
  } catch {
    return {}
  }
}

export function saveAlarmPlans(plans) {
  localStorage.setItem(keys().alarmPlans, JSON.stringify(plans))
  notifyRecordsChanged()   // 분모(그날 알람 목록)가 바뀌므로 지표도 다시 계산해야 한다
}

export function getRecordRulesSince() {
  return localStorage.getItem(keys().recordRulesSince)
}

export function setRecordRulesSince(dateKey) {
  localStorage.setItem(keys().recordRulesSince, dateKey)
}

// Returns a small sequential integer safe for use as a Capacitor notification ID
export function generateId() {
  const settings = getSettings()
  const maxId = Math.max(0, ...settings.alarms.map(a => Number(a.id) || 0))
  return maxId + 1
}

// --- Data export ---

export function exportAllData() {
  return {
    exportedAt: new Date().toISOString(),
    version: APP_VERSION,
    settings: getSettings(),
    records: getRecords(),
    notifLog: getNotifLog(),
  }
}

