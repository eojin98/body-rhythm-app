const SETTINGS_KEY = 'bodyrhythm_settings'
const RECORDS_KEY = 'bodyrhythm_records'
const NOTIF_LOG_KEY = 'bodyrhythm_notif_log'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

export { DAY_NAMES }

const DEFAULT_ALARMS = [
  { id: 1, name: '기상', time: '07:00', days: [0,1,2,3,4,5,6], enabled: true, icon: '🌅' },
  { id: 2, name: '아침 식사', time: '07:30', days: [0,1,2,3,4,5,6], enabled: true, icon: '🍳' },
  { id: 3, name: '점심 식사', time: '12:00', days: [0,1,2,3,4,5,6], enabled: true, icon: '🥗' },
  { id: 4, name: '저녁 식사', time: '18:30', days: [0,1,2,3,4,5,6], enabled: true, icon: '🍚' },
  { id: 5, name: '운동', time: '19:00', days: [1,2,3,4,5], enabled: true, icon: '💪' },
  { id: 6, name: '취침 준비', time: '22:30', days: [0,1,2,3,4,5,6], enabled: true, icon: '🌙' },
]

const DEFAULT_SETTINGS = {
  onboardingComplete: false,
  wakeTime: '07:00',
  sleepTime: '23:00',
  alarms: DEFAULT_ALARMS,
}

export function getSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    if (!data) return { ...DEFAULT_SETTINGS, alarms: [...DEFAULT_ALARMS] }
    const saved = JSON.parse(data)
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return { ...DEFAULT_SETTINGS, alarms: [...DEFAULT_ALARMS] }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function getRecords() {
  try {
    const data = localStorage.getItem(RECORDS_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function saveRecord(date, record) {
  const records = getRecords()
  records[date] = { ...records[date], ...record }
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
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

export function calculatePracticeRate(record) {
  if (!record || !record.completed) return 0
  let score = 0
  if (record.wakeOnTime) score += 25
  const mealCount = [record.meals?.breakfast, record.meals?.lunch, record.meals?.dinner].filter(Boolean).length
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
    const data = localStorage.getItem(NOTIF_LOG_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function markNotifFired(alarmId, minuteKey) {
  const log = getNotifLog()
  log[`${alarmId}_${minuteKey}`] = true
  // Keep log small - only last 100 entries
  const keys = Object.keys(log)
  if (keys.length > 100) {
    const toDelete = keys.slice(0, keys.length - 100)
    toDelete.forEach(k => delete log[k])
  }
  localStorage.setItem(NOTIF_LOG_KEY, JSON.stringify(log))
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

export function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}
