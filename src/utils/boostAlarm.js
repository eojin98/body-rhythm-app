import { Capacitor, registerPlugin } from '@capacitor/core'
import { saveRoutineAction } from './storage'

const BoostAlarm = registerPlugin('BoostAlarm')
const isNative = () => Capacitor.isNativePlatform()

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
    for (const { periodId, date, action } of list) {
      if (action === 'done' || action === 'skipped') {
        saveRoutineAction(date, periodId, action)
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
