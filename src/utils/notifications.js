import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { wasNotifFired, markNotifFired, getSettings } from './storage'
import { ALARM_PERIODS, TEST_HOURLY_BEHAVIORS } from './alarmContent'
import { scheduleBoostAlarms, cancelBoostAlarms } from './boostAlarm'

const isNative = () => Capacitor.isNativePlatform()

// ─── Date helpers for firedDate/firedHour ────────────────────────────────────

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Derives the alarm's actual fire date from notification extras.
 *
 * One-shot notifications (snooze) store an exact `firedDate` string.
 * Repeating daily notifications store `firedHour` (the scheduled hour).
 * Heuristic: if firedHour > current hour, the notification is from a past
 * occurrence (most likely yesterday) — use yesterday's date.
 * Returns null when neither field is present (caller falls back to today).
 */
function resolveFiredDate(extra) {
  if (extra.firedDate) return extra.firedDate
  if (extra.firedHour != null) {
    const now = new Date()
    if (extra.firedHour > now.getHours()) {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return dateKey(d)
    }
  }
  return null
}

/**
 * Returns the Unix-ms timestamp of when the alarm originally fired.
 * Used for the 15-minute reaction deadline check (POINT_POLICY.REACTION_DEADLINE_MS).
 *
 * Snooze notifications carry `originalFiredAtMs` (set when the snooze was scheduled)
 * so the deadline is always measured from the FIRST fire, not the snooze re-fire.
 * Repeating alarms reconstruct the time from `firedHour` + `firedMinute` + `firedDate`.
 */
/**
 * 스누즈로 미뤄진 누적 시간(ms). 15분 반응 기한에 이만큼 더해준다.
 *
 * 기한은 최초 발화 시각(originalFiredAtMs) 기준이라, 30분 스누즈를 쓰면 재발화 시점에
 * 이미 15분이 지나 무조건 0P가 되어버린다. 스누즈로 미룬 시간만큼 기한을 늘려주면
 * "재발화 후 15분 안에 반응" 이라는 원래 취지대로 동작한다.
 * (강화알람의 timerExtra와 같은 방식)
 */
function resolveSnoozeExtraMs(extra) {
  return extra.snoozeExtraMs ?? 0
}

function resolveFirstFiredAtMs(extra) {
  if (extra.originalFiredAtMs != null) return extra.originalFiredAtMs
  if (extra.firedHour != null) {
    const firedDate = resolveFiredDate(extra)
    if (firedDate) {
      const h = String(extra.firedHour).padStart(2, '0')
      const m = String(extra.firedMinute ?? 0).padStart(2, '0')
      return new Date(`${firedDate}T${h}:${m}:00`).getTime()
    }
  }
  return null
}

// Native plugin to check device ringer mode (Android only)
const DeviceRinger = registerPlugin('DeviceRinger')

// Listen for ringer mode changes from the native plugin.
// callback() is invoked whenever the mode transitions (e.g. normal → vibrate).
// Returns a cleanup function to remove the listener.
export function addRingerModeListener(callback) {
  if (!isNative()) return () => {}
  const handle = DeviceRinger.addListener('ringerModeChanged', callback)
  return () => handle.then(h => h.remove()).catch(() => {})
}

/**
 * Resolves the notification channel for the current alarmSoundMode setting:
 *   'sound'   → CHANNEL_SOUND   (always plays sound, ignores ringer mode)
 *   'vibrate' → CHANNEL_VIBRATE (always vibrates only, ignores ringer mode)
 *   'system'  → follows device ringer:
 *                 RINGER_MODE_NORMAL  (2) → CHANNEL_SOUND
 *                 RINGER_MODE_VIBRATE (1) → CHANNEL_VIBRATE
 *                 RINGER_MODE_SILENT  (0) → CHANNEL_SILENT
 * Any unrecognised value falls through to 'system' behaviour.
 */
async function resolveChannelId(soundMode) {
  if (soundMode === 'sound')   return CHANNEL_SOUND
  if (soundMode === 'vibrate') return CHANNEL_VIBRATE
  // 'system' or legacy value — follow device ringer mode
  if (!isNative()) return CHANNEL_SOUND
  try {
    const { mode } = await DeviceRinger.getRingerMode()
    if (mode === 0) return CHANNEL_SILENT   // RINGER_MODE_SILENT
    if (mode === 1) return CHANNEL_VIBRATE  // RINGER_MODE_VIBRATE
    return CHANNEL_SOUND                   // RINGER_MODE_NORMAL (2)
  } catch {
    return CHANNEL_SOUND
  }
}

// ─── Notification Channels (Android 8+) ──────────────────────────────────────
// 채널은 한 번 생성되면 Android가 설정을 캐시하므로 중요 속성 변경 시 채널 ID를 바꿔야 함
// v2: alarm_vibrate importance 5→4, alarm_silent importance 3→2
// alarm_sound_v2: 'alarm_sound' 채널이 일부 기기에서 소리 없이 캐시되는 버그 수정용 신규 채널
const CHANNEL_SOUND   = 'alarm_sound_v2'
const CHANNEL_VIBRATE = 'alarm_vibrate_v2'
const CHANNEL_SILENT  = 'alarm_silent_v2'

export async function initNotificationChannels() {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_SOUND,       // 'alarm_sound_v2'
      name: '알람 (소리 + 진동)',
      description: '소리와 진동으로 알람을 알립니다',
      importance: 5,
      vibration: true,
      lights: true,
      lightColor: '#6C5CE7',
      visibility: 1,
      // sound 미지정 → 시스템 기본 알림음 사용 (벨소리 모드 따름)
    })
    await LocalNotifications.createChannel({
      id: CHANNEL_VIBRATE,   // 'alarm_vibrate_v2'
      name: '알람 (진동만)',
      description: '진동으로만 알람을 알립니다',
      // importance 4 (HIGH): heads-up 표시 유지하면서 sound: null이 올바르게 적용됨
      // importance 5 (MAX)에서는 일부 Android 버전이 sound: null을 무시함
      importance: 4,
      vibration: true,
      sound: null,
      lights: true,
      lightColor: '#6C5CE7',
      visibility: 1,
    })
    await LocalNotifications.createChannel({
      id: CHANNEL_SILENT,   // 'alarm_silent_v2'
      name: '알람 (무음)',
      description: '소리와 진동 없이 알람을 표시합니다',
      // importance 2 (LOW): Android에서 소리·진동을 확실히 차단하는 유일한 방법
      // importance 3 (DEFAULT)은 기본적으로 소리를 재생함
      importance: 2,
      vibration: false,
      sound: null,
      lights: false,
      visibility: 1,
    })
  } catch (e) {
    console.warn('Channel creation failed:', e)
  }
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

// ─── Notification Action Types ────────────────────────────────────────────────
// Register action type "HABIT_ACTION" with 3 buttons for Android notification drawer
export async function registerNotificationActionTypes() {
  if (!isNative()) return
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'HABIT_ACTION',
          actions: [
            { id: 'done',  title: '✅ 완료' },
            { id: 'later', title: '🔔 나중에' },
            { id: 'skip',  title: '✖ 건너뜀' },
          ],
        },
      ],
    })
  } catch (e) {
    console.warn('registerActionTypes failed:', e)
  }
}

// Set up listener for notification action button clicks.
// Calls onAction(periodId, action, snoozeMins, firedDate, firstFiredAtMs, snoozeExtraMs) when a button is tapped.
// Must be called once on app init (before any notification fires).
export function initNotificationActionListener(onAction) {
  if (!isNative()) return () => {}
  const handle = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      const extra = event.notification?.extra || {}
      const periodId = extra.periodId
      if (!periodId) return

      const firedDate     = resolveFiredDate(extra)
      const firstFiredAtMs = resolveFirstFiredAtMs(extra)
      const snoozeExtraMs = resolveSnoozeExtraMs(extra)
      const actionId = event.actionId // 'done' | 'later' | 'skip' | 'tap'
      if (actionId === 'done') {
        onAction(periodId, 'done', undefined, firedDate, firstFiredAtMs, snoozeExtraMs)
      } else if (actionId === 'later') {
        const snoozeMins = periodId.startsWith('test_') ? 10 : 30
        onAction(periodId, 'snooze', snoozeMins, firedDate, firstFiredAtMs, snoozeExtraMs)
      } else if (actionId === 'skip') {
        onAction(periodId, 'skipped', undefined, firedDate, firstFiredAtMs, snoozeExtraMs)
      }
      // 'tap' (사용자가 알림 자체를 탭) — 앱을 열기만 하므로 별도 처리 없음
    },
  )
  return () => handle.then(h => h.remove()).catch(() => {})
}

// Schedule repeating weekly notifications for one alarm (one per enabled day)
export async function scheduleAlarmNotifications(alarm, soundMode) {
  if (!isNative()) return
  await cancelAlarmNotifications(alarm.id, [0, 1, 2, 3, 4, 5, 6])
  if (!alarm.enabled || alarm.days.length === 0) return

  const mode = soundMode ?? getSettings().alarmSoundMode ?? 'system'
  const channelId = await resolveChannelId(mode)
  const [hour, minute] = alarm.time.split(':').map(Number)
  const { title, body } = buildNotifContent(alarm)
  const notifications = alarm.days.map(dayIndex => ({
    id: toNotifId(alarm.id, dayIndex),
    title,
    body,
    channelId,
    actionTypeId: 'HABIT_ACTION',
    extra: { periodId: alarm.type, alarmId: alarm.id, firedHour: hour, firedMinute: minute },
    schedule: {
      // second: 0 — Android AlarmManager가 초 단위를 현재 시각에서 상속하지 않도록 명시
      on: { weekday: dayIndex + 1, hour, minute, second: 0 },
      repeats: true,
      allowWhileIdle: true,
      exact: true,
    },
  }))

  await LocalNotifications.schedule({ notifications })
}

// Schedule a one-time snooze notification (native only)
// originalFiredAtMs: Unix ms of the alarm's FIRST fire time (for policy 2 deadline preservation)
// prevSnoozeExtraMs: 이전까지 스누즈로 미룬 누적 시간(ms). 이번 스누즈 분을 더해 넘긴다.
export async function scheduleSnoozeNotification(alarm, snoozeMins = 30, originalFiredAtMs = null, prevSnoozeExtraMs = 0) {
  if (!isNative()) return
  const { title, body } = buildNotifContent(alarm)
  const snoozeId = toNotifId(alarm.id, 8) // slot 8 = snooze
  const channelId = await resolveChannelId(getSettings().alarmSoundMode ?? 'system')
  try {
    await LocalNotifications.cancel({ notifications: [{ id: snoozeId }] })
  } catch {}
  const snoozeAt = new Date(Date.now() + snoozeMins * 60 * 1000)
  snoozeAt.setSeconds(0, 0)
  await LocalNotifications.schedule({
    notifications: [{
      id: snoozeId,
      title,
      body,
      channelId,
      actionTypeId: 'HABIT_ACTION',
      extra: {
        periodId: alarm.type,
        alarmId: alarm.id,
        firedDate: dateKey(snoozeAt),
        originalFiredAtMs,
        snoozeExtraMs: prevSnoozeExtraMs + snoozeMins * 60 * 1000,
      },
      schedule: {
        at: snoozeAt,
        allowWhileIdle: true,
        exact: true,
      },
    }],
  })
}

// Schedule a one-time snooze for test-mode hourly alarms (ID 9098, fixed slot)
const TEST_SNOOZE_NOTIF_ID = 9098

// originalFiredAtMs: Unix ms of the alarm's FIRST fire time (for policy 2 deadline preservation)
// prevSnoozeExtraMs: 이전까지 스누즈로 미룬 누적 시간(ms). 이번 스누즈 분을 더해 넘긴다.
export async function scheduleTestSnoozeNotification(hk, behavior, snoozeMins = 10, originalFiredAtMs = null, prevSnoozeExtraMs = 0) {
  if (!isNative()) return
  const h = parseInt(hk, 10)
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
  const period = h < 12 ? '오전' : '오후'
  const channelId = await resolveChannelId(getSettings().alarmSoundMode ?? 'system')
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TEST_SNOOZE_NOTIF_ID }] })
  } catch {}
  const testSnoozeAt = new Date(Date.now() + snoozeMins * 60 * 1000)
  testSnoozeAt.setSeconds(0, 0)
  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_SNOOZE_NOTIF_ID,
      title: `⏰ ${period} ${dh}:00 루틴`,
      body: behavior?.title ?? '루틴 알람',
      channelId,
      actionTypeId: 'HABIT_ACTION',
      extra: {
        periodId: `test_${hk}`,
        firedDate: dateKey(testSnoozeAt),
        originalFiredAtMs,
        snoozeExtraMs: prevSnoozeExtraMs + snoozeMins * 60 * 1000,
      },
      schedule: {
        at: testSnoozeAt,
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

export async function cancelAllAlarmNotifications(alarms) {
  if (!isNative()) return
  for (const alarm of alarms) {
    await cancelAlarmNotifications(alarm.id, [0, 1, 2, 3, 4, 5, 6])
    try { await LocalNotifications.cancel({ notifications: [{ id: toNotifId(alarm.id, 8) }] }) } catch {}
  }
  await cancelTestHourlyNotifications()
  try { await LocalNotifications.cancel({ notifications: [{ id: TEST_SNOOZE_NOTIF_ID }] }) } catch {}
}

// Test mode: hourly notifications 7:00–23:00 every day (IDs 9007–9023)
const TEST_HOURLY_NOTIF_BASE_ID = 9000

export async function scheduleTestHourlyNotifications(hourlyAlarmSettings = {}) {
  if (!isNative()) return
  await cancelTestHourlyNotifications()
  const channelId = await resolveChannelId(getSettings().alarmSoundMode ?? 'system')
  const notifications = []
  for (let h = 7; h <= 23; h++) {
    const hk = String(h).padStart(2, '0')
    const behavior = TEST_HOURLY_BEHAVIORS[hk]
    if (!behavior) continue
    const hourSetting = hourlyAlarmSettings[hk] ?? { enabled: true }
    if (!hourSetting.enabled) continue
    if (hourSetting.boostMode) continue // boost-mode hours are handled by BoostAlarmService
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h
    const period = h < 12 ? '오전' : '오후'
    notifications.push({
      id: TEST_HOURLY_NOTIF_BASE_ID + h,
      title: `⏰ ${period} ${dh}:00 루틴`,
      body: behavior.title,
      channelId,
      actionTypeId: 'HABIT_ACTION',
      extra: { periodId: `test_${hk}`, firedHour: h, firedMinute: 0 },
      schedule: {
        on: { hour: h, minute: 0, second: 0 },
        repeats: true,
        allowWhileIdle: true,
        exact: true,
      },
    })
  }
  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications })
  }
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
  const settings = getSettings()
  for (const alarm of alarms) {
    await scheduleAlarmNotifications(alarm)
  }
  if (testMode) {
    await scheduleTestHourlyNotifications(settings.hourlyAlarmSettings ?? {})
    await scheduleBoostAlarms(settings.hourlyAlarmSettings ?? {})
  } else {
    await cancelTestHourlyNotifications()
    await cancelBoostAlarms()
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
