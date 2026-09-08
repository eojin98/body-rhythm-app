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
    for (const { periodId, date, action, timerSeconds, firedAt, respondedAt, occurrenceId = null } of list) {
      // 15분(REACTION_DEADLINE_MS) 기준 시각은 "사용자가 버튼을 누른 시각"(respondedAt) —
      // 앱을 나중에 열어 이 동기화가 실행되는 시각(now)을 기준으로 삼으면, 제때 반응한 사용자도
      // 앱을 늦게 열었다는 이유만으로 지각 처리될 수 있다.
      // respondedAt이 없는 구버전 pending action만 now로 폴백하고, 그 사실을 사유 코드에 남긴다.
      const usedLegacyFallback = respondedAt == null
      const respondedAtMs = usedLegacyFallback ? now : respondedAt
      // timer_complete는 타이머 실행 시간(timerSeconds)만큼 허용 시간을 추가 부여
      const timerExtra = action === 'timer_complete' ? (timerSeconds || 0) * 1000 : 0
      const isLate = firedAt != null && (respondedAtMs - firedAt) > POINT_POLICY.REACTION_DEADLINE_MS + timerExtra
      const legacySuffix = isLate && usedLegacyFallback ? '_legacy' : ''
      if (action === 'done') {
        saveRoutineAction(date, periodId, 'done')
        recordPoint({
          date, alarmId: periodId,
          action: isLate ? `boost_complete_late${legacySuffix}` : 'boost_complete',
          occurrenceId, points: isLate ? 0 : undefined,
        })
      } else if (action === 'timer_complete') {
        saveRoutineAction(date, periodId, 'done')
        recordPoint({
          date, alarmId: periodId,
          action: isLate ? `boost_timer_complete_late${legacySuffix}` : 'boost_timer_complete',
          timerSeconds: isLate ? null : timerSeconds, occurrenceId, points: isLate ? 0 : undefined,
        })
      } else if (action === 'skipped') {
        saveRoutineAction(date, periodId, 'skipped')
        // 건너뜀 = 0P. 사유 추적을 위해 0P도 원장에 기록한다(policy 4 변경).
        recordPoint({ date, alarmId: periodId, action: 'boost_skipped', occurrenceId, points: 0 })
      } else if (action === 'timeout') {
        saveRoutineAction(date, periodId, 'skipped')
        // 60초 무응답 자동 종료 — 사용자가 직접 건너뛴 것과 구분해서 기록한다.
        recordPoint({ date, alarmId: periodId, action: 'boost_timeout', occurrenceId, points: 0 })
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

// ─── SYSTEM_ALERT_WINDOW (Draw over other apps) ──────────────────────────────

/**
 * Returns { granted: boolean }.
 * If granted, boost alarms launch as a full-screen Activity even while the device is in use
 * (instead of heads-up notification which can be swiped away on some Samsung/Xiaomi firmware).
 */
export async function checkOverlayPermission() {
  if (!isNative()) return { granted: false }
  try { return await BoostAlarm.checkOverlayPermission() } catch { return { granted: false } }
}

/**
 * Opens Settings > Apps > [App] > Display over other apps.
 * The user can grant SYSTEM_ALERT_WINDOW from there.
 */
export async function openOverlaySettings() {
  if (!isNative()) return
  try { await BoostAlarm.openOverlaySettings() } catch {}
}
