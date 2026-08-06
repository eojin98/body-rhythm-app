import { Capacitor, registerPlugin } from '@capacitor/core'
import { saveRoutineAction } from './storage'
import { recordPoint, POINT_POLICY } from './pointLedger'
import { TEST_HOURLY_BEHAVIORS } from './alarmContent'

const BoostAlarm = registerPlugin('BoostAlarm')
const isNative = () => Capacitor.isNativePlatform()

// ─── Occurrence status constants (mirrors Java BoostAlarmPlugin) ──────────────
export const AlarmOccurrenceStatus = {
  SCHEDULED:     'SCHEDULED',
  RINGING:       'RINGING',
  SNOOZED:       'SNOOZED',
  TIMER_RUNNING: 'TIMER_RUNNING',
  COMPLETED:     'COMPLETED',
  CANCELLED:     'CANCELLED',
  SKIPPED:       'SKIPPED',
  EXPIRED:       'EXPIRED',
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

/**
 * Schedules daily boost alarms for every hour that has both enabled=true and boostMode=true.
 * If no such hours exist, cancels all boost alarms.
 * Call this after any change to hourlyAlarmSettings when testMode is ON.
 */
export async function scheduleBoostAlarms(hourlyAlarmSettings = {}) {
  if (!isNative()) return
  const hours = Object.entries(hourlyAlarmSettings)
    .filter(([, s]) => s.enabled && s.boostMode)
    .map(([hk]) => parseInt(hk, 10))

  if (hours.length === 0) {
    await BoostAlarm.cancelAll()
  } else {
    await BoostAlarm.scheduleAlarms({ hours })
  }
}

export async function cancelBoostAlarms() {
  if (!isNative()) return
  try { await BoostAlarm.cancelAll() } catch {}
}

/**
 * Returns the currently-running timer state if any, for the cold-start banner.
 * { active: true, hour, remainingSeconds, alarmLabel } or { active: false }
 */
export async function getActiveTimerState() {
  if (!isNative()) return { active: false }
  try {
    const result = await BoostAlarm.getActiveTimerState()
    if (!result.active) return { active: false }
    const hk = String(result.hour).padStart(2, '0')
    const alarmLabel = TEST_HOURLY_BEHAVIORS[hk]?.title ?? `${hk}:00 루틴`
    return { active: true, hour: result.hour, remainingSeconds: result.remainingSeconds, alarmLabel }
  } catch {
    return { active: false }
  }
}

/**
 * Fires a one-shot test boost alarm N ms from now (default 5 s).
 * Use this from the Settings dev button to verify the fullscreen alarm chain works.
 */
export async function scheduleTestBoostAlarm(delayMs = 5000) {
  if (!isNative()) return
  try {
    await BoostAlarm.scheduleTestAlarm({ delayMs })
  } catch (e) {
    console.warn('[boostAlarm] scheduleTestAlarm error:', e)
    throw e
  }
}

// ─── Pending action sync ──────────────────────────────────────────────────────

/**
 * Reads pending done/skipped actions that were recorded by BoostAlarmActivity
 * while the Capacitor app was dead or backgrounded, then saves them to localStorage.
 *
 * Call this on app start and on every 'visibilitychange' to visible.
 */
export async function syncPendingBoostActions() {
  if (!isNative()) return
  try {
    const { actions } = await BoostAlarm.getPendingActions()
    const list = JSON.parse(actions || '[]')
    const now = Date.now()
    for (const { periodId, date, action, timerSeconds, firedAt, occurrenceId = null } of list) {
      // 15분(REACTION_DEADLINE_MS) 초과 응답: 루틴 기록은 정상 저장, 포인트는 0(미기록)
      // timer_complete는 타이머 실행 시간(timerSeconds)만큼 허용 시간을 추가 부여
      const timerExtra = action === 'timer_complete' ? (timerSeconds || 0) * 1000 : 0
      const isLate = firedAt != null && (now - firedAt) > POINT_POLICY.REACTION_DEADLINE_MS + timerExtra
      if (action === 'done') {
        saveRoutineAction(date, periodId, 'done')
        recordPoint({ date, alarmId: periodId, action: 'boost_complete', occurrenceId, points: isLate ? 0 : undefined })
      } else if (action === 'timer_complete') {
        saveRoutineAction(date, periodId, 'done')
        recordPoint({ date, alarmId: periodId, action: 'boost_timer_complete', timerSeconds: isLate ? null : timerSeconds, occurrenceId, points: isLate ? 0 : undefined })
      } else if (action === 'skipped') {
        saveRoutineAction(date, periodId, 'skipped')
        // 건너뜀 = 0P → 원장 미기록 (policy 4). 회차 종결은 AlarmOccurrenceStatus가 보장.
      }
    }
  } catch (e) {
    console.warn('[boostAlarm] syncPendingBoostActions error:', e)
  }
}

// ─── USE_FULL_SCREEN_INTENT permission (Android 14+ only) ────────────────────

/**
 * Returns { granted: boolean }.
 * On Android 14+, USE_FULL_SCREEN_INTENT is restricted for non alarm-clock apps by default.
 * If false, the boost alarm will still play sound/vibrate but the lock-screen Activity
 * won't pop up — only a heads-up notification is shown.
 */
export async function checkFullScreenIntentPermission() {
  if (!isNative()) return { granted: true }
  try { return await BoostAlarm.checkFullScreenIntentPermission() } catch { return { granted: true } }
}

/**
 * Opens the system settings page where the user can allow full-screen intents for this app.
 * Settings > Apps > Body Rhythm 알람 > Notifications > Allow full-screen intents
 * Only has effect on Android 14+.
 */
export async function openFullScreenIntentSettings() {
  if (!isNative()) return
  try { await BoostAlarm.openFullScreenIntentSettings() } catch {}
}

/**
 * Opens the OS notification settings page for this app so the user can enable/disable
 * notification permission (Settings > Apps > Body Rhythm 알람 > Notifications).
 */
export async function openAppNotificationSettings() {
  if (!isNative()) return
  try { await BoostAlarm.openAppNotificationSettings() } catch {}
}
