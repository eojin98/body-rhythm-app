import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IonAccordion,
  IonAccordionGroup,
  IonItem,
} from '@ionic/react'
import { CIRCADIAN_DATA, PHASE_COLORS, type CircadianHour } from '../data/circadianGuide'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const HOURS = CIRCADIAN_DATA.map(d => d.hour)

const STRENGTH_META: Record<string, { label: string; bg: string; color: string }> = {
  confirmed:   { label: '근거 확실', bg: '#D4EDDA', color: '#1A5C2E' },
  strong:      { label: '근거 강함', bg: '#D1E7FD', color: '#0C447C' },
  moderate:    { label: '근거 중간', bg: '#FFF3CD', color: '#7A4F00' },
  conditional: { label: '조건부',   bg: '#E2E3E5', color: '#41464B' },
}

function getCurrentHour(): number {
  return Math.min(Math.max(new Date().getHours(), 6), 23)
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function CircadianDetailPage() {
  const navigate = useNavigate()
  const [selectedHour, setSelectedHour] = useState<number>(getCurrentHour)
  const scrollRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  const data: CircadianHour = CIRCADIAN_DATA.find(d => d.hour === selectedHour)!
  const colors = PHASE_COLORS[data.phase]

  // 매 정각마다 현재 시간으로 자동 갱신
  useEffect(() => {
    function scheduleUpdate() {
      const now = new Date()
      const ms =
        (60 - now.getMinutes()) * 60_000
        - now.getSeconds() * 1000
        - now.getMilliseconds()
      const t = setTimeout(() => { setSelectedHour(getCurrentHour()); scheduleUpdate() }, ms)
      return t
    }
    const t = scheduleUpdate()
    return () => clearTimeout(t)
  }, [])

  // 선택된 시간 버튼을 가로 스크롤 중앙으로
  useEffect(() => {
    const idx = HOURS.indexOf(selectedHour)
    const btn = btnRefs.current[idx]
    if (!btn || !scrollRef.current) return
    const container = scrollRef.current
    const btnLeft = btn.offsetLeft
    const btnWidth = btn.offsetWidth
    const containerWidth = container.offsetWidth
    container.scrollTo({
      left: btnLeft - containerWidth / 2 + btnWidth / 2,
      behavior: 'smooth',
    })
  }, [selectedHour])

  return (
    // position:fixed 로 부모 page-content 레이아웃에서 탈출해 전체 화면 점유
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#F4F3FB',
      overflow: 'hidden',
    }}>

      {/* ── 상단 헤더 ── */}
      <div style={{
        background: 'white',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        flexShrink: 0,
        boxShadow: '0 1px 0 #EBEBF0',
      }}>
        {/* 타이틀 행 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 10px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#F0EFF8', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#6C5CE7', flexShrink: 0,
            }}
            aria-label="홈으로"
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E1E2E', lineHeight: 1.2 }}>
              일주기 리듬 가이드
            </div>
            <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 1 }}>
              시간별 신체 상태와 최적 행동
            </div>
          </div>
        </div>

        {/* ── 시간 버튼 스크롤 ── */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            overflowX: 'auto',
            gap: 6,
            padding: '0 16px 12px',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {HOURS.map((h, idx) => {
            const d = CIRCADIAN_DATA.find(x => x.hour === h)!
            const c = PHASE_COLORS[d.phase]
            const isActive = h === selectedHour
            return (
              <button
                key={h}
                ref={el => { btnRefs.current[idx] = el }}
                onClick={() => setSelectedHour(h)}
                style={{
                  flexShrink: 0,
                  minWidth: 52, height: 52,
                  borderRadius: 14,
                  border: isActive ? 'none' : `1.5px solid ${c.accent}33`,
                  background: isActive ? c.accent : 'white',
                  color: isActive ? 'white' : c.accent,
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 1,
                  transition: 'background 0.15s, color 0.15s',
                  boxShadow: isActive ? `0 2px 8px ${c.accent}55` : 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: isActive ? 800 : 600, lineHeight: 1 }}>
                  {h}
                </span>
                <span style={{ fontSize: 9, opacity: isActive ? 0.85 : 0.5 }}>시</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 본문 스크롤 영역 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 24px' }}>

        {/* ── 헤더 카드 (컴팩트) ── */}
        <div style={{
          background: colors.bg,
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: colors.text }}>
                {String(data.hour).padStart(2, '0')}:00
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.accent }}>
                {data.phaseName}
              </span>
              <span style={{ fontSize: 12, color: colors.text, opacity: 0.65 }}>
                · {data.stateName}
              </span>
            </div>
            {/* 호르몬 태그 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {data.hormones.map((h, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 600,
                  background: 'rgba(0,0,0,0.08)', color: colors.text,
                  padding: '3px 8px', borderRadius: 20,
                }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
          {/* 에너지 배지 */}
          <span style={{
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            background: colors.accent, color: 'white',
            padding: '5px 11px', borderRadius: 20,
            alignSelf: 'flex-start',
          }}>
            {data.energyLevel}
          </span>
        </div>

        {/* ── 권장 행동 ── */}
        <Section title="✅ 지금 할 일">
          {data.actions.map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              paddingBottom: i < data.actions.length - 1 ? 10 : 0,
              borderBottom: i < data.actions.length - 1 ? '1px solid #F0EFF8' : 'none',
              marginBottom: i < data.actions.length - 1 ? 10 : 0,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: colors.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 11, fontWeight: 700, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E1E2E', marginBottom: 2 }}>
                  {a.label}
                </div>
                <div style={{ fontSize: 11, color: '#6E6E8A', lineHeight: 1.55 }}>
                  {a.reason}
                </div>
              </div>
            </div>
          ))}
        </Section>

        {/* ── 주의 항목 ── */}
        {data.warnings.length > 0 && (
          <Section title="⚠ 주의할 것">
            {data.warnings.map((w, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                paddingBottom: i < data.warnings.length - 1 ? 10 : 0,
                borderBottom: i < data.warnings.length - 1 ? '1px solid #FFE8E8' : 'none',
                marginBottom: i < data.warnings.length - 1 ? 10 : 0,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: '#FF7675',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, marginTop: 1,
                }}>
                  ✕
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C0392B', marginBottom: 2 }}>
                    {w.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#E07070', lineHeight: 1.55 }}>
                    {w.reason}
                  </div>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* ── 과학적 근거 (IonAccordion) ── */}
        <Section title="🔬 과학적 근거">
          <IonAccordionGroup>
            {data.science.map((s, i) => {
              const meta = STRENGTH_META[s.strength] ?? STRENGTH_META.moderate
              return (
                <IonAccordion
                  key={`${selectedHour}-${i}`}
                  value={String(i)}
                  style={{ '--background': 'transparent' } as React.CSSProperties}
                >
                  <IonItem slot="header" lines="none" style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--inner-padding-end': '4px',
                    '--min-height': '44px',
                  } as React.CSSProperties}>
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      gap: 8, width: '100%', padding: '6px 0',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E1E2E', flex: 1, lineHeight: 1.5 }}>
                        {s.claim}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, flexShrink: 0,
                        background: meta.bg, color: meta.color,
                        padding: '2px 7px', borderRadius: 20,
                        alignSelf: 'flex-start', marginTop: 3,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                  </IonItem>
                  <div slot="content" style={{
                    fontSize: 11, color: '#6E6E8A', lineHeight: 1.65,
                    padding: '8px 4px 10px',
                    borderTop: '1px solid #F0EFF8',
                  }}>
                    {s.evidence}
                  </div>
                </IonAccordion>
              )
            })}
          </IonAccordionGroup>
        </Section>

      </div>
    </div>
  )
}

// ── 섹션 래퍼 ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#A0A0B8',
        letterSpacing: 0.4, marginBottom: 6, paddingLeft: 2,
      }}>
        {title}
      </div>
      <div style={{
        background: 'white', borderRadius: 14,
        padding: '12px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {children}
      </div>
    </div>
  )
}
