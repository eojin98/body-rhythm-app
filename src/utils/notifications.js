import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { wasNotifFired, markNotifFired, getSettings } from './storage'
import { ALARM_PERIODS, TEST_HOURLY_BEHAVIORS } from './alarmContent'

const isNative = () => Capacitor.isNativePlatform()

// ─── Notification Channels (Android 8+) ──────────────────────────────────────
const CHANNEL_SOUND   = 'alarm_sound'
const CHANNEL_VIBRATE = 'alarm_vibrate'
const CHANNEL_SILENT  = 'alarm_silent'

export async function initNotificationChannels() {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_SOUND,
      name: '알람 (소리 + 진동)',
      description: '소리와 진동으로 알람을 알립니다',
      importance: 5,
      vibration: true,
      lights: true,
      lightColor: '#6C5CE7',
      visibility: 1,
    })
    await LocalNotifications.createChannel({
      id: CHANNEL_VIBRATE,
      name: '알람 (진동만)',
      description: '진동으로만 알람을 알립니다',
      importance: 5,
      vibration: true,
      sound: null,
      lights: true,
      lightColor: '#6C5CE7',
      visibility: 1,
    })
    await LocalNotifications.createChannel({
      id: CHANNEL_SILENT,
      name: '알람 (무음)',
      description: '소리와 진동 없이 알람을 표시합니다',
      importance: 3,
      vibration: false,
      sound: null,
      lights: false,
      visibility: 1,
    })
  } catch (e) {
    console.warn('Channel creation failed:', e)
  }
}

function getChannelId(soundMode) {
  if (soundMode === 'vibrate') return CHANNEL_VIBRATE
  if (soundMode === 'silent') return CHANNEL_SILENT
  return CHANNEL_SOUND
}

// Capacitor weekday: 1=Sun, 2=Mon, ..., 7=Sat
// JS getDay():       0=Sun, 1=Mon, ..., 6=Sat
// Notification ID: alarmId * 10 + dayIndex (keeps IDs under 2^31 for reasonable alarmId values)
function toNotifId(alarmId, dayIndex) {
  return (Number(alarmId) % 10000000) * 10 + dayIndex
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hour}:${String(m).padStart(2, '0')}`
}

// --- Permission ---

export async function requestNotificationPermission() {
  if (isNative()) {
    try {
      const result = await LocalNotifications.requestPermissions()
      return result.display === 'granted' ? 'granted' : 'denied'
    } catch {
      return 'denied'
    }
  }
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

// Sync version for initial render (native returns 'unknown' until async check completes)
export function getPermissionStatus() {
  if (isNative()) return 'unknown'
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// Async version for accurate status on both platforms
export async function checkPermissionStatusAsync() {
  if (isNative()) {
    try {
      const result = await LocalNotifications.checkPermissions()
      return result.display === 'granted' ? 'granted' : result.display
    } catch {
      return 'denied'
    }
  }
  return getPermissionStatus()
}

// --- Native: schedule/cancel local notifications ---

// Build notification title/body from behavior content (if available)
function buildNotifContent(alarm) {
  const period = alarm.type ? ALARM_PERIODS[alarm.type] : null
  if (period) {
    const actionTitles = period.behaviors.map(b => b.title).join(' · ')
    return {
      title: `${period.icon} ${period.name}`,
      body: `${actionTitles} 시간이에요!`,
    }
  }
  return {
    title: `${alarm.icon || '⏰'} ${alarm.name}`,
    body: `${formatTime12(alarm.time)} 알람입니다. 몸의 리듬을 지켜요!`,
  }
}

// Schedule repeating weekly notifications for one alarm (one per enabled day)
export async function scheduleAlarmNotifications(alarm, soundMode) {
  if (!isNative()) return
  await cancelAlarmNotifications(alarm.id, [0, 1, 2, 3, 4, 5, 6])
  if (!alarm.enabled || alarm.days.length === 0) return

  const mode = soundMode ?? getSettings().alarmSoundMode ?? 'sound'
  const channelId = getChannelId(mode)
  const [hour, minute] = alarm.time.split(':').map(Number)
  const { title, body } = buildNotifContent(alarm)
  const notifications = alarm.days.map(dayIndex => ({
    id: toNotifId(alarm.id, dayIndex),
    title,
    body,
    channelId,
    schedule: {
      on: { weekday: dayIndex + 1, hour, minute },
      repeats: true,
      allowWhileIdle: true,
      exact: true,
    },
  }))

  await LocalNotifications.schedule({ notifications })
}

// Schedule a one-time snooze notification (native only)
export async function scheduleSnoozeNotification(alarm, snoozeMins = 30) {
  if (!isNative()) return
  const { title, body } = buildNotifContent(alarm)
  const snoozeId = toNotifId(alarm.id, 8) // slot 8 = snooze
  const channelId = getChannelId(getSettings().alarmSoundMode ?? 'sound')
  try {
    await LocalNotifications.cancel({ notifications: [{ id: snoozeId }] })
  } catch {}
  await LocalNotifications.schedule({
    notifications: [{
      id: snoozeId,
      title,
      body,
      channelId,
      schedule: {
        at: new Date(Date.now() + snoozeMins * 60 * 1000),
        allowWhileIdle: true,
        exact: true,
      },
    }],
  })
}

// Schedule a one-time snooze for test-mode hourly alarms (ID 9098, fixed slot)
const TEST_SNOOZE_NOTIF_ID = 9098

export async function scheduleTestSnoozeNotification(hk, behavior, snoozeMins = 10) {
  if (!isNative()) return
  const h = parseInt(hk, 10)
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
  const period = h < 12 ? '오전' : '오후'
  const channelId = getChannelId(getSettings().alarmSoundMode ?? 'sound')
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TEST_SNOOZE_NOTIF_ID }] })
  } catch {}
  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_SNOOZE_NOTIF_ID,
      title: `⏰ ${period} ${dh}:00 루틴`,
      body: behavior?.title ?? '루틴 알람',
      channelId,
      schedule: {
        at: new Date(Date.now() + snoozeMins * 60 * 1000),
        allowWhileIdle: true,
        exact: true,
      },
    }],
  })
}

export async function cancelAlarmNotifications(alarmId, days = [0, 1, 2, 3, 4, 5, 6]) {
  if (!isNative()) return
  const notifications = days.map(d => ({ id: toNotifId(alarmId, d) }))
  try {
    await LocalNotifications.cancel({ notifications })
  } catch {
    // ignore: notification may not have been scheduled yet
  }
}

// Test mode: hourly notifications 7:00–23:00 every day (IDs 9007–9023)
const TEST_HOURLY_NOTIF_BASE_ID = 9000

export async function scheduleTestHourlyNotifications() {
  if (!isNative()) return
  await cancelTestHourlyNotifications()
  const channelId = getChannelId(getSettings().alarmSoundMode ?? 'sound')
  const notifications = []
  for (let h = 7; h <= 23; h++) {
    const hk = String(h).padStart(2, '0')
    const behavior = TEST_HOURLY_BEHAVIORS[hk]
    if (!behavior) continue
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
    const period = h < 12 ? '오전' : '오후'
    notifications.push({
      id: TEST_HOURLY_NOTIF_BASE_ID + h,
      title: `⏰ ${period} ${dh}:00 루틴`,
      body: behavior.title,
      channelId,
      schedule: {
        on: { hour: h, minute: 0 },
        repeats: true,
        allowWhileIdle: true,
        exact: true,
      },
    })
  }
  await LocalNotifications.schedule({ notifications })
}

export async function cancelTestHourlyNotifications() {
  if (!isNative()) return
  const ids = []
  for (let h = 7; h <= 23; h++) ids.push({ id: TEST_HOURLY_NOTIF_BASE_ID + h })
  try { await LocalNotifications.cancel({ notifications: ids }) } catch {}
}

// Re-sync all alarms on app start (native only)
export async function syncAllAlarmNotifications(alarms, testMode = false) {
  if (!isNative()) return
  for (const alarm of alarms) {
    await scheduleAlarmNotifications(alarm)
  }
  if (testMode) {
    await scheduleTestHourlyNotifications()
  } else {
    await cancelTestHourlyNotifications()
  }
}

// --- Web fallback: immediate notification ---

export function showNotification(title, body) {
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: title,
      renotify: true,
      requireInteraction: false,
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch (e) {
    console.warn('Notification failed:', e)
  }
}

// Web-only polling: called every 30s to fire alarms at the right minute
export function checkAndFireAlarms(alarms) {
  if (isNative() || !alarms || Notification.permission !== 'granted') return

  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`
  const currentDay = now.getDay()
  const minuteKey = `${now.toDateString()}_${currentTime}`

  alarms.forEach(alarm => {
    if (!alarm.enabled) return
    if (!alarm.days.includes(currentDay)) return
    if (alarm.time !== currentTime) return
    if (wasNotifFired(alarm.id, minuteKey)) return

    markNotifFired(alarm.id, minuteKey)
    const { title, body } = buildNotifContent(alarm)
    showNotification(title, body)
  })
}
