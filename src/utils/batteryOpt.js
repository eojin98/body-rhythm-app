import { Capacitor, registerPlugin } from '@capacitor/core'

const BatteryOpt = registerPlugin('BatteryOpt')

export async function isBatteryOptIgnored() {
  if (!Capacitor.isNativePlatform()) return true
  try {
    const { isIgnoring } = await BatteryOpt.isIgnoringBatteryOptimizations()
    return isIgnoring === true
  } catch {
    return true
  }
}

export async function requestBatteryOptExemption() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await BatteryOpt.requestIgnoreBatteryOptimizations()
  } catch {}
}

export async function canScheduleExactAlarms() {
  if (!Capacitor.isNativePlatform()) return true
  try {
    const { canSchedule } = await BatteryOpt.canScheduleExactAlarms()
    return canSchedule === true
  } catch {
    return true
  }
}

export async function openExactAlarmSettings() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await BatteryOpt.openExactAlarmSettings()
  } catch {}
}
