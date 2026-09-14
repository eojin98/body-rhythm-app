import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { syncPointsToServer } from '../lib/pointSync'
import { getStage, getCharacterImage } from '../utils/characterLogic'
import { registerBackHandler } from '../utils/backHandler'

const RANK_LIMIT = 50
// 랭킹 응답에는 컨디션(mood) 정보가 없어 보통(2)으로 고정해 표시한다
const RANK_MOOD = 2

const TABS = [
  { id: 'total',   label: '누적',    rpc: 'get_ranking_total' },
  { id: 'monthly', label: '이번 달', rpc: 'get_ranking_monthly' },
]

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function RankingModal({ onClose }) {
  const [tab, setTab] = useState('total')
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [reloadKey, setReloadKey] = useState(0)
  // 모달을 연 뒤 첫 조회 전에 한 번만 동기화한다. 탭 전환 시에는 같은 promise를 기다린다.
  const syncRef = useRef(null)

  // 하드웨어 뒤로가기: 열려 있는 동안 App.jsx가 closeTopOverlay()로 이 모달부터 닫는다
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => registerBackHandler(() => onCloseRef.current()), [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      // 랭킹은 서버 집계를 읽으므로 로컬에만 있는 포인트를 먼저 올린다.
      // syncPointsToServer는 실패해도 reject하지 않으므로 랭킹 조회는 항상 이어진다.
      if (!syncRef.current) syncRef.current = syncPointsToServer()
      await syncRef.current

      const rpc = TABS.find(t => t.id === tab).rpc
      const { data, error } = await supabase.rpc(rpc, { p_limit: RANK_LIMIT })
      if (cancelled) return
      if (error) {
        console.warn(`[RankingModal] ${rpc} 실패:`, error)
        setStatus('error')
        return
      }
      setRows(data ?? [])
      setStatus('ready')
    })().catch(e => {
      if (cancelled) return
      console.warn('[RankingModal] 랭킹 조회 예외:', e)
      setStatus('error')
    })
    return () => { cancelled = true }
  }, [tab, reloadKey])

  const retry = () => {
    syncRef.current = null // 재시도 때는 동기화도 다시 시도한다
    setReloadKey(k => k + 1)
  }

  // 서버는 상위 50위 뒤에, 본인이 그 밖이면 본인 행을 마지막 줄에 붙여 보낸다
  const last = rows[rows.length - 1]
  const meOutside = !!last?.is_me && (rows.length > RANK_LIMIT || Number(last.rank) > RANK_LIMIT)
  const listRows = meOutside ? rows.slice(0, -1) : rows

  return createPortal(
    <div onClick={onClose} style={overlayStyle}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="랭킹"
        style={sheetStyle}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1E1E2E' }}>👑 랭킹</div>
          <button onClick={onClose} aria-label="닫기" style={closeBtnStyle}>✕</button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, margin: '0 20px 12px', padding: 4, background: '#F5F4FF', borderRadius: 12 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', minHeight: 240 }}>
          {status === 'loading' && <Message>불러오는 중…</Message>}

          {status === 'error' && (
            <Message>
              <div style={{ marginBottom: 14 }}>랭킹을 불러오지 못했습니다</div>
              <button onClick={retry} style={retryBtnStyle}>다시 시도</button>
            </Message>
          )}

          {status === 'ready' && rows.length === 0 && <Message>아직 랭킹이 없습니다</Message>}

          {status === 'ready' && listRows.map((row, i) => (
            <RankRow key={`${row.rank}-${i}`} row={row} />
          ))}
        </div>

        {/* ── 본인이 목록 밖(51위 이하)일 때 ── */}
        {status === 'ready' && meOutside && (
          <div style={{ borderTop: '1px dashed #D0CFEE', padding: '8px 12px 12px' }}>
            <div style={{ fontSize: 11, color: '#A0A0B8', padding: '0 8px 6px' }}>내 순위</div>
            <RankRow row={last} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function RankRow({ row }) {
  const rank = Number(row.rank)
  // 표시용: 탭별 집계 (누적 탭=누적, 월간 탭=이번 달)
  const points = Number(row.total_points) || 0
  // 단계용: 항상 전체 누적. lifetime_points가 없는 구버전 응답이면 total_points로 대체
  const lifetimePoints = Number(row.lifetime_points ?? row.total_points) || 0
  const src = getCharacterImage(row.character_id, getStage(lifetimePoints), RANK_MOOD)
  const hasCharacter = row.character_id != null

  return (
    <div style={rowStyle(row.is_me)}>
      <div style={{
        width: 32, flexShrink: 0, textAlign: 'center',
        fontSize: MEDALS[rank] ? 20 : 14, fontWeight: 800, color: '#6E6E8A',
      }}>
        {MEDALS[rank] ?? rank}
      </div>

      <RankAvatar key={src ?? 'none'} src={src} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: hasCharacter ? '#1E1E2E' : '#A0A0B8',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {hasCharacter ? row.character_name : '캐릭터 미선택'}
          </span>
          {row.is_me && (
            <span style={{
              flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#fff',
              background: '#6C5CE7', borderRadius: 6, padding: '1px 6px',
            }}>나</span>
          )}
        </div>
        <div style={{
          fontSize: 12, color: '#A0A0B8', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {row.nickname}
        </div>
      </div>

      <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#6C5CE7' }}>
        {points.toLocaleString()}P
      </div>
    </div>
  )
}

// 이미지 비율 300x333 유지, 하단 정렬. 캐릭터 미선택(src=null)이나 로드 실패 시 중립 표시.
function RankAvatar({ src }) {
  const [failed, setFailed] = useState(false)
  return (
    <div style={{
      width: 40, height: 44, flexShrink: 0,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
        />
      ) : (
        <div style={{
          width: 36, height: 36, marginBottom: 4, borderRadius: '50%',
          background: '#F0F0F8', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, opacity: 0.5, userSelect: 'none',
        }}>🐾</div>
      )}
    </div>
  )
}

function Message({ children }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: '#A0A0B8' }}>
      {children}
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(10, 10, 30, 0.60)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 16px',
}

const sheetStyle = {
  width: '100%', maxWidth: 420, maxHeight: '80vh',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  background: '#FFFFFF', borderRadius: 24,
  boxShadow: '0 12px 40px rgba(108, 92, 231, 0.20)',
}

const closeBtnStyle = {
  width: 32, height: 32, borderRadius: '50%', border: 'none',
  background: '#F5F4FF', color: '#6E6E8A', fontSize: 14,
  cursor: 'pointer', fontFamily: 'inherit',
}

const tabStyle = (active) => ({
  flex: 1, padding: '8px 0', borderRadius: 9, border: 'none',
  background: active ? '#FFFFFF' : 'transparent',
  color: active ? '#6C5CE7' : '#A0A0B8',
  boxShadow: active ? '0 1px 4px rgba(108, 92, 231, 0.15)' : 'none',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
})

const rowStyle = (isMe) => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 8px', marginBottom: 4, borderRadius: 14,
  background: isMe ? '#F5F4FF' : 'transparent',
  border: `1.5px solid ${isMe ? '#A29BFE' : 'transparent'}`,
})

const retryBtnStyle = {
  padding: '10px 20px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
  color: '#FFFFFF', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}
