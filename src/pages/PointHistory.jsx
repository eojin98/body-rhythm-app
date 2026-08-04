import { useNavigate } from 'react-router-dom'
import { getAllEntries } from '../utils/pointLedger'
import { getTodayKey } from '../utils/storage'

function getYesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtGroupDate(dateStr, todayKey, yesterdayKey) {
  if (dateStr === todayKey) return '오늘'
  if (dateStr === yesterdayKey) return '어제'
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

export default function PointHistory() {
  const navigate = useNavigate()
  const todayKey = getTodayKey()
  const yesterdayKey = getYesterdayKey()

  // getAllEntries() returns newest-first; preserve that order for groups
  const entries = getAllEntries()
  const orderedDates = []
  const groupMap = new Map()
  for (const entry of entries) {
    if (!groupMap.has(entry.date)) {
      orderedDates.push(entry.date)
      groupMap.set(entry.date, [])
    }
    groupMap.get(entry.date).push(entry)
  }

  return (
    <div className="page fade-up">
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 24, color: '#1E1E2E', padding: '4px 8px 4px 0', lineHeight: 1, flexShrink: 0,
          }}
        >
          ‹
        </button>
        <div>
          <div className="header-title">포인트 내역</div>
          <div className="header-sub">전체 적립 기록</div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="section">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">아직 적립된 포인트가 없어요</div>
          </div>
        </div>
      ) : (
        orderedDates.map(date => {
          const items = groupMap.get(date)
          return (
            <div key={date} className="section" style={{ paddingBottom: 0 }}>
              {/* Date group header */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#A0A0B8',
                letterSpacing: 0.4, padding: '0 4px 8px',
              }}>
                {fmtGroupDate(date, todayKey, yesterdayKey)}
              </div>

              <div className="card">
                {items.map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 16px',
                      borderBottom: i < items.length - 1 ? '1px solid #F0EFF8' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: '#1E1E2E',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {entry.alarmLabel}
                      </div>
                      <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 2 }}>
                        {entry.time}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, flexShrink: 0, marginLeft: 12,
                      color: entry.points > 0 ? '#6C5CE7' : '#C0C0D0',
                    }}>
                      {entry.points > 0 ? `+${entry.points}P` : '0P'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
      <div style={{ height: 24 }} />
    </div>
  )
}
