// 하루 알람 목록(계획)과 미실행 확정.
//
// - 그날 울리는 알람 = 켜진 시간별 알람(시간별 알람 사용 시) + 켜진 시간대 알람.
//   꺼둔 알람은 목록에 넣지 않으므로 기록·분모에서 빠진다.
// - 미실행 확정 시점: 시간별은 다음 정시, 시간대는 예정 시각 + 120분. 모두 그날 자정을 넘지 않는다.
// - 확정 시점이 지났는데 칸이 비어 있으면 'missed'로 채운다. 이미 기록된 칸은 건드리지 않는다.
// - 새 규칙은 이 코드가 처음 실행된 날(recordRulesSince)부터만 적용한다. 그 이전 날짜는 채우지 않는다.
import { Capacitor } from '@capacitor/core'
import {
  getSettings, getRecords, getAlarmPlans, saveAlarmPlans,
  getRecordRulesSince, setRecordRulesSince, markRoutinesMissed, isPlanEntryLive,
} from './storage'
import { syncPendingBoostActions } from './boostAlarm'
import { TEST_HOURLY_BEHAVIORS } from './alarmContent'

const DAY_END_MIN = 24 * 60     // 확정 시점 상한: 그날이 끝나는 순간
const PERIOD_GRACE_MIN = 120    // 시간대 알람: 예정 시각 + 120분
const MAX_BACKFILL_DAYS = 400

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}

function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

// 현재 설정 기준으로 그날 울리는 알람 목록을 만든다
function plannedAlarmsFor(settings, key) {
  const list = []
  if (settings.testMode) {
    for (const hk of Object.keys(TEST_HOURLY_BEHAVIORS)) {
      if (settings.hourlyAlarmSettings?.[hk]?.enabled === false) continue
      const h = parseInt(hk, 10)
      list.push({ id: `test_${hk}`, ringMin: h * 60, deadlineMin: Math.min((h + 1) * 60, DAY_END_MIN) })
    }
  }
  const dow = weekdayOf(key)
  for (const a of settings.alarms ?? []) {
    if (!a.enabled || !a.type || !a.days?.includes(dow)) continue
    const [h, m] = a.time.split(':').map(Number)
    list.push({ id: a.type, ringMin: h * 60 + m, deadlineMin: Math.min(h * 60 + m + PERIOD_GRACE_MIN, DAY_END_MIN) })
  }
  return list
}

/**
 * 날짜별 알람 목록을 만들거나 갱신한다. sinceMin = 그 칸이 목록에 들어온 시각(분).
 * - 오늘: 설정이 바뀔 수 있어 매번 갱신한다. 이미 목록이 있는 날 새로 생긴 칸, 시각이 바뀐 칸,
 *   규칙 적용 첫날의 칸은 지금부터 적용한다. 목록에 들어온 뒤에 울리는 칸만 대상이 되므로
 *   (isPlanEntryLive) 이미 울릴 시각이 지난 알람을 미실행으로 소급하지 않는다.
 * - 목록이 없는 지난 날(앱을 열지 않은 날): 설정은 앱 안에서만 바뀌므로, 마지막으로 저장된 설정
 *   (= 지금 설정)으로 그날 목록을 만든다.
 * - 목록이 있는 지난 날은 그대로 둔다.
 */
function updatePlans(now) {
  const settings = getSettings()
  if (!settings.onboardingComplete) return false

  const today = dayKey(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let since = getRecordRulesSince()
  const firstRun = !since
  if (firstRun) {
    since = today
    setRecordRulesSince(today)
  }

  const plans = getAlarmPlans()
  let changed = false
  const floor = addDays(today, -MAX_BACKFILL_DAYS)
  for (let key = since > floor ? since : floor; key <= today; key = addDays(key, 1)) {
    const prev = plans[key]
    if (key !== today) {
      if (prev) continue
      plans[key] = plannedAlarmsFor(settings, key).map(e => ({ ...e, sinceMin: 0 }))
      changed = true
      continue
    }
    const prevById = new Map((prev ?? []).map(e => [e.id, e]))
    const startMin = firstRun || prev ? nowMin : 0
    const next = plannedAlarmsFor(settings, key).map(e => {
      const p = prevById.get(e.id)
      const same = p && p.ringMin === e.ringMin && p.deadlineMin === e.deadlineMin
      return { ...e, sinceMin: same ? p.sinceMin : startMin }
    })
    if (!prev || JSON.stringify(prev) !== JSON.stringify(next)) {
      plans[key] = next
      changed = true
    }
  }
  if (changed) saveAlarmPlans(plans)
  return true
}

function fillMissed(now) {
  const since = getRecordRulesSince()
  if (!since) return
  const today = dayKey(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const plans = getAlarmPlans()
  const records = getRecords()

  const toMark = {}
  for (const [key, entries] of Object.entries(plans)) {
    if (key < since || key > today) continue
    for (const e of entries) {
      if (!isPlanEntryLive(e)) continue                        // 목록에 들어오기 전에 이미 울릴 시각이 지난 칸
      if (key === today && nowMin < e.deadlineMin) continue    // 오늘, 아직 확정 시점 전
      if (records[key]?.routines?.[e.id]?.status) continue     // 이미 기록된 칸
      if (!toMark[key]) toMark[key] = []
      toMark[key].push(e.id)
    }
  }
  if (Object.keys(toMark).length) markRoutinesMissed(toMark)
}

async function runReconcile() {
  if (!updatePlans(new Date())) return
  // 강화알람의 대기 응답을 먼저 반영한다. 완료를 눌렀는데 앱을 늦게 열어 미실행이 먼저 찍히면
  // 확정된 칸은 다시 바뀌지 않으므로, 반드시 대기 응답 처리 → 미실행 확정 순서여야 한다.
  if (Capacitor.isNativePlatform()) await syncPendingBoostActions()
  fillMissed(new Date())
}

let chain = Promise.resolve()

/** 알람 목록 갱신 → 강화알람 대기 응답 반영 → 미실행 확정. 여러 곳에서 불려도 한 번에 하나씩 실행된다. */
export function reconcileRecords() {
  chain = chain.then(runReconcile).catch(e => console.warn('[recordReconcile]', e))
  return chain
}
