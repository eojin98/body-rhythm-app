import { supabase } from './supabase'
import { getUnsyncedEntries, markEntriesSynced } from '../utils/pointLedger'

let _syncing = false

/**
 * 로컬 포인트 원장의 미동기화 항목을 Supabase에 업로드한다.
 *
 * 안전 원칙:
 * - 미로그인/오프라인이면 조용히 skip (에러 없음)
 * - 서버 오류가 발생해도 로컬 원장은 절대 건드리지 않음
 * - 중복 실행 방지: 이전 sync가 진행 중이면 즉시 반환
 * - upsert ignoreDuplicates: 재시도 시 서버 중복 삽입 없음
 */
export async function syncPointsToServer() {
  if (_syncing) return
  _syncing = true
  try {
    await _doSync()
  } catch {
    // 예상치 못한 오류 — 로컬 원장은 그대로, 다음 기회에 재시도
  } finally {
    _syncing = false
  }
}

/**
 * 서버 point_transactions 테이블의 occurrence_id 결정.
 * - 강화알람: Java가 생성한 UUID (e.occurrenceId)
 * - 일반 알람: occurrenceId가 없으므로 "date__alarmId" 합성 문자열 사용
 *   → unique(user_id, occurrence_id) 제약을 만족하는 결정적 ID
 */
function resolveOccurrenceId(entry) {
  if (entry.occurrenceId) return entry.occurrenceId
  return `${entry.date}__${entry.alarmId}`
}

async function _doSync() {
  // 로컬 캐시에서 세션 확인 (네트워크 불필요)
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id
  if (!userId) return

  const unsynced = getUnsyncedEntries()
  if (unsynced.length === 0) return

  // 기존 테이블 컬럼에 맞춰 전송: id, user_id, occurrence_id, alarm_id, date, action, points, created_at
  // (created_at은 DB DEFAULT now()로 자동 입력)
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

  if (error) return  // 네트워크 오류 등 — 다음 포그라운드 복귀 시 재시도

  // 서버 쓰기 성공 → 로컬에 synced 표시 (local id 기준)
  markEntriesSynced(unsynced.map(e => e.id))

  // 서버 잔액 RPC 갱신 (실패해도 무시 — 트랜잭션 데이터는 이미 저장됨)
  await _refreshBalance(userId)
}

async function _refreshBalance(userId) {
  try {
    await supabase.rpc('refresh_user_balance', { uid: userId })
  } catch {
    // RPC 미설정이거나 네트워크 실패 — 무시
  }
}

/** 서버에 저장된 포인트 합계 (개발/검증용). 실패 시 null 반환. */
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
