import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { GROWTH_STAGES, MOODS, getCharacterImage } from '../utils/characterLogic'
import { POINT_ACTIONS, POINT_VALUES, POINT_POLICY } from '../utils/pointLedger'
import { registerBackHandler } from '../utils/backHandler'

// 성장 단계 그림은 상태에 따라 달라 보이지 않도록 '보통'으로 고정해 보여준다
const NEUTRAL_MOOD = 2
const STAGE_IMG_HEIGHT = 64
const MOOD_IMG_HEIGHT = 84

// MOODS는 minRate 내림차순이라 각 구간의 상한은 바로 위 항목의 minRate가 된다
function moodRangeText(index) {
  const { minRate } = MOODS[index]
  if (index === 0) return `실천률 ${minRate}% 이상`
  const upper = MOODS[index - 1].minRate
  return minRate === 0 ? `${upper}% 미만` : `${minRate}% 이상 ${upper}% 미만`
}

// 배점은 POINT_VALUES에서 읽는다. 타이머 완료는 실행 시간에 따라 달라져 값이 null이다.
const POINT_ROWS = [
  { label: '일반 알람 완료',        action: POINT_ACTIONS.NORMAL_COMPLETE },
  { label: '강화 알람 완료',        action: POINT_ACTIONS.BOOST_COMPLETE },
  { label: '강화 알람 타이머 완료', action: POINT_ACTIONS.BOOST_TIMER_COMPLETE },
]

const DEADLINE_MIN = Math.round(POINT_POLICY.REACTION_DEADLINE_MS / 60000)

export default function CharacterGuideModal({ characterId = null, stage = 1, onClose }) {
  // 하드웨어 뒤로가기: 열려 있는 동안 App.jsx가 closeTopOverlay()로 이 모달부터 닫는다
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => registerBackHandler(() => onCloseRef.current()), [])

  return createPortal(
    <div onClick={onClose} style={overlayStyle}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="캐릭터 안내"
        style={sheetStyle}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1E1E2E' }}>🐾 캐릭터 안내</div>
          <button onClick={onClose} aria-label="닫기" style={closeBtnStyle}>✕</button>
        </div>

        {/* ── 본문 (길어지면 스크롤) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

          {/* 1. 캐릭터 상태 */}
          <section style={sectionStyle}>
            <div style={titleStyle}>캐릭터 상태</div>
            <div style={subStyle}>최근 7일 실천률에 따라 캐릭터의 컨디션이 달라져요.</div>
            {characterId != null && (
              <div style={rowStyle}>
                {MOODS.map((m, i) => (
                  <ImageItem
                    key={m.mood}
                    src={getCharacterImage(characterId, stage, m.mood)}
                    height={MOOD_IMG_HEIGHT}
                    title={m.label}
                    caption={moodRangeText(i)}
                  />
                ))}
              </div>
            )}
            {characterId == null && (
              <div style={listCardStyle}>
                {MOODS.map((m, i) => (
                  <div key={m.mood} style={listRowStyle(i === MOODS.length - 1)}>
                    <span style={{ fontWeight: 700, color: '#1E1E2E' }}>{m.label}</span>
                    <span style={{ color: '#6E6E8A' }}>{moodRangeText(i)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={noteStyle}>
              오늘 기록은 내일부터 반영돼요. 아직 알람이 울리지 않은 시간에 실천률이 낮게 보이지
              않도록, 어제까지의 7일로 계산합니다.
            </div>
          </section>

          {/* 2. 성장 단계 */}
          <section style={sectionStyle}>
            <div style={titleStyle}>성장 단계</div>
            <div style={subStyle}>모은 포인트만큼 캐릭터가 자라요. 총 {GROWTH_STAGES.length}단계까지 있어요.</div>
            {characterId != null && (
              <div style={rowStyle}>
                {GROWTH_STAGES.map(s => (
                  <ImageItem
                    key={s.stage}
                    src={getCharacterImage(characterId, s.stage, NEUTRAL_MOOD)}
                    height={STAGE_IMG_HEIGHT}
                    title={`${s.stage}단계`}
                    caption={s.minPoints === 0 ? '시작' : `${s.minPoints.toLocaleString()}P`}
                  />
                ))}
              </div>
            )}
            {characterId == null && (
              <div style={listCardStyle}>
                {GROWTH_STAGES.map((s, i) => (
                  <div key={s.stage} style={listRowStyle(i === GROWTH_STAGES.length - 1)}>
                    <span style={{ fontWeight: 700, color: '#1E1E2E' }}>{s.stage}단계</span>
                    <span style={{ color: '#6E6E8A' }}>
                      {s.minPoints === 0 ? '시작' : `${s.minPoints.toLocaleString()}P 이상`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={noteStyle}>한 번 오른 단계는 내려가지 않아요.</div>
          </section>

          {/* 3. 상태와 성장의 차이 */}
          <section style={sectionStyle}>
            <div style={titleStyle}>상태와 성장은 어떻게 다른가요?</div>
            <div style={{ ...subStyle, marginBottom: 0 }}>
              성장 단계는 지금까지 모은 포인트라 되돌아가지 않는 기록이에요. 상태는 요즘 얼마나
              실천했는지 보여주는 신호라서 며칠 단위로 바뀝니다. 그래서 잠시 쉬어 상태가 '지침'이
              되더라도, 그동안 키운 단계는 그대로 남아 있어요.
            </div>
          </section>

          {/* 4. 키우는 방법 */}
          <section style={{ ...sectionStyle, marginBottom: 0 }}>
            <div style={titleStyle}>포인트 모으는 법</div>
            <div style={subStyle}>알람을 제때 완료하면 포인트가 쌓여요.</div>
            <div style={listCardStyle}>
              {POINT_ROWS.map(({ label, action }, i) => {
                const value = POINT_VALUES[action]
                return (
                  <div key={action} style={listRowStyle(i === POINT_ROWS.length - 1)}>
                    <span style={{ fontWeight: 700, color: '#1E1E2E' }}>{label}</span>
                    <span style={{ color: '#6C5CE7', fontWeight: 700 }}>
                      {value != null ? `${value}P` : '타이머 길이에 따라 더 많이'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={noteStyle}>
              알람이 울리고 {DEADLINE_MIN}분 안에 반응해야 해요. 시간을 넘기면 완료로 기록되지만
              포인트는 쌓이지 않아요.
            </div>
          </section>

        </div>
      </div>
    </div>,
    document.body,
  )
}

// 원본은 하단 정렬로 그려져 있어, 고정 높이 칸에 바닥을 맞추면 단계별 크기 차이가 그대로 보인다
function ImageItem({ src, height, title, caption }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <div style={{ height, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {src && (
          <img
            src={src}
            alt=""
            onError={e => { e.currentTarget.style.display = 'none' }}
            style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
          />
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#1E1E2E' }}>{title}</div>
      <div style={{ marginTop: 1, fontSize: 11, color: '#A0A0B8', wordBreak: 'keep-all' }}>{caption}</div>
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

const sectionStyle = { marginBottom: 22 }

const titleStyle = { fontSize: 15, fontWeight: 800, color: '#1E1E2E', marginBottom: 4 }

const subStyle = { fontSize: 13, color: '#6E6E8A', lineHeight: 1.6, marginBottom: 12 }

const noteStyle = { fontSize: 12, color: '#A0A0B8', lineHeight: 1.6, marginTop: 10 }

const rowStyle = {
  display: 'flex', alignItems: 'flex-end', gap: 6,
  background: '#F5F4FF', borderRadius: 14, padding: '12px 10px',
}

const listCardStyle = { background: '#F5F4FF', borderRadius: 14, padding: '4px 14px' }

const listRowStyle = (isLast) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  fontSize: 13, padding: '9px 0',
  borderBottom: isLast ? 'none' : '1px solid #E6E3FA',
})
