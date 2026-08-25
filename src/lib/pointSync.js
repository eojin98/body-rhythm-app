import { supabase } from './supabase'
import { getUnsyncedEntries, markEntriesSynced, mergeEntriesFromServer } from '../utils/pointLedger'

let _syncing = false
// syncFromServer가 세팅 → syncPointsToServer가 최종 결과에 포함시키고 소비
let _pendingPulled = 0

// ─── 결과 저장 ─────────────────────────────────────────────────────────────────

function _writeSyncResult({ ok, pushed, pulled, error = null }) {
  const result = {
    at: new Date().toISOString(),
    ok,
    pushed: pushed ?? 0,
    pulled: pulled ?? 0,
    error,
  }
  try {
    localStorage.setItem('lastSyncResult', JSON.stringify(result))
    window.dispatchEvent(new CustomEvent('bodyrhythm:syncComplete'))
  } catch {}
}

// ─── 로컬 → 서버 ───────────────────────────────────────────────────────────────

/**
 * 로컬 포인트 원장의 미동기화 항목을 Supabase에 업로드한다.
 *
 * 안전 원칙:
 * - 미로그인/오프라인이면 조용히 skip (에러 없음)
 * - 서버 오류가 발생해도 로컬 원장은 절대 건드리지 않음
 * - 중복 실행 방지: 이전 sync가 진행 중이면 즉시 반환
 */
export async function syncPointsToServer() {
  if (_syncing) return
  _syncing = true
  const pulled = _pendingPulled
  _pendingPulled = 0  // 이번 사이클의 pulled 카운트 소비
  try {
    const result = await _doSync()
    if (result !== null) {  // null = 로그인 안 됨, 결과 저장 불필요
      _writeSyncResult({ ...result, pulled })
    }
  } catch (e) {
    console.warn('[pointSync] syncPointsToServer exception:', e)
    _writeSyncResult({ ok: false, pushed: 0, pulled, error: e?.message ?? '알 수 없는 오류' })
  } finally {
    _syncing = false
  }
}

function resolveOccurrenceId(entry) {
  if (entry.occurrenceId) return entry.occurrenceId
  return `${entry.date}__${entry.alarmId}`
}

/**
 * @returns {{ ok: boolean, pushed: number, error: string|null } | null}
 *   null → 로그인 안 됨 (결과 저장 생략)
 */
async function _doSync() {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id
  if (!userId) return null

  const unsynced = getUnsyncedEntries()
  if (unsynced.length === 0) return { ok: true, pushed: 0, error: null }

  const rows = unsynced.map(e => ({
    user_id:       userId,
    occurrence_id: resolveOccurrenceId(e),
    alarm_id:      e.alarmId,
    date:          e.date,
    action:        e.action,
    points:        e.points,
  }))

  const { error } = await supabase
    .from('point_transactions')
    .upsert(rows, { onConflict: 'user_id,occurrence_id', ignoreDuplicates: true })

  if (error) {
    console.warn('[pointSync] upsert error:', error)
    return {
      ok: false,
      pushed: 0,
      error: [error.code, error.message].filter(Boolean).join(' '),
    }
  }

  markEntriesSynced(unsynced.map(e => e.id))
  await _refreshBalance(userId)
  return { ok: true, pushed: unsynced.length, error: null }
}

async function _refreshBalance(userId) {
  try {
    await supabase.rpc('refresh_user_balance', { uid: userId })
  } catch (e) {
    console.warn('[pointSync] _refreshBalance exception:', e)
  }
}

// ─── 서버 → 로컬 ───────────────────────────────────────────────────────────────

/**
 * 서버 → 로컬 동기화. 로그인 성공 직후 호출.
 * pulled 건수를 _pendingPulled에 저장하고, 이후 syncPointsToServer()가 최종 결과에 포함.
 */
export async function syncFromServer(userId) {
  _pendingPulled = 0  // 새 동기화 사이클 시작
  if (!userId) return
  try {
    const { data, error } = await supabase
      .from('point_transactions')
      .select('occurrence_id, alarm_id, date, action, points, created_at')
      .eq('user_id', userId)

    if (error) {
      console.warn('[syncFromServer] error:', error)
      return
    }
    if (!data) return
    _pendingPulled = mergeEntriesFromServer(data)
  } catch (e) {
    console.warn('[syncFromServer] exception:', e)
  }
}

// ─── 개발/검증용 ───────────────────────────────────────────────────────────────

/** 서버에 저장된 포인트 합계. 실패 시 null 반환. */
export async function getServerTotalPoints() {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id
    if (!userId) return null
    const { data } = await supabase
      .from('user_point_balances')
      .select('total_points')
      .eq('user_id', userId)
      .single()
    return data?.total_points ?? null
  } catch {
    return null
  }
}
