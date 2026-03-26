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
}

export function getSettings() {
  try {
    const data = localStorage.getItem(keys().settings)
    if (!data) return { ...DEFAULT_SETTINGS, alarms: [...DEFAULT_ALARMS] }
    const saved = JSON.parse(data)
    // Migrate old food-based alarms to new behavior-based alarms
    const needsMigration = !saved.alarms?.length || saved.alarms.some(a => !a.type)
    if (needsMigration) {
      return { ...DEFAULT_SETTINGS, ...saved, alarms: [...DEFAULT_ALARMS] }
    }
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_SETTINGS, alarms: [...DEFAULT_ALARMS] }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(keys().settings, JSON.stringify(settings))
}

export function getRecords() {
  try {
    const data = localStorage.getItem(keys().records)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function saveRecord(date, record) {
  const records = getRecords()
  records[date] = { ...records[date], ...record }
  localStorage.setItem(keys().records, JSON.stringify(records))
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

export function calculatePracticeRate(record) {
  if (!record || !record.completed) return 0
  let score = 0
  if (record.wakeOnTime) score += 25
  const mealCount = ['breakfast', 'lunch', 'dinner'].filter(k => isMealEaten(record.meals?.[k])).length
  if (mealCount >= 2) score += 25
  if (record.exercise) score += 25
  if (record.completed) score += 25
  return score
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

// --- Routine actions (완료/건너뛰기 per period per day) ---

export function saveRoutineAction(dateKey, periodId, status) {
  const records = getRecords()
  const record = records[dateKey] || {}
  records[dateKey] = {
    ...record,
    routines: {
      ...record.routines,
      [periodId]: { status, updatedAt: new Date().toISOString() },
    },
  }
  localStorage.setItem(keys().records, JSON.stringify(records))
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

// Returns a small sequential integer safe for use as a Capacitor notification ID
export function generateId() {
  const settings = getSettings()
  const maxId = Math.max(0, ...settings.alarms.map(a => Number(a.id) || 0))
  return maxId + 1
}
