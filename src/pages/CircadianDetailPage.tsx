import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
} from '@ionic/react'
import { CIRCADIAN_DATA, PHASE_COLORS, type CircadianHour } from '../data/circadianGuide'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const HOURS = CIRCADIAN_DATA.map(d => d.hour) // [6, 7, ..., 23]

const STRENGTH_META: Record<string, { label: string; bg: string; color: string }> = {
  confirmed:   { label: '근거 확실', bg: '#D4EDDA', color: '#1A5C2E' },
  strong:      { label: '근거 강함', bg: '#D1E7FD', color: '#0C447C' },
  moderate:    { label: '근거 중간', bg: '#FFF3CD', color: '#7A4F00' },
  conditional: { label: '조건부',   bg: '#E2E3E5', color: '#41464B' },
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function getCurrentHour(): number {
  const h = new Date().getHours()
  return Math.min(Math.max(h, 6), 23)
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function CircadianDetailPage() {
  const navigate = useNavigate()
  const [selectedHour, setSelectedHour] = useState<number>(getCurrentHour)
  const segmentRef = useRef<HTMLIonSegmentElement>(null)

  const data: CircadianHour = CIRCADIAN_DATA.find(d => d.hour === selectedHour)!
  const colors = PHASE_COLORS[data.phase]

  // 매 정각마다 현재 시간으로 자동 갱신
  useEffect(() => {
    function scheduleUpdate() {
      const now = new Date()
      const msUntilNextHour =
        (60 - now.getMinutes()) * 60 * 1000
        - now.getSeconds() * 1000
        - now.getMilliseconds()
      const t = setTimeout(() => {
        setSelectedHour(getCurrentHour())
        scheduleUpdate()
      }, msUntilNextHour)
      return t
    }
    const t = scheduleUpdate()
    return () => clearTimeout(t)
  }, [])

  // 선택 시간 변경 시 해당 탭으로 스크롤
  useEffect(() => {
    const el = segmentRef.current
    if (!el) return
    const btn = el.querySelector<HTMLElement>(`[data-hour="${selectedHour}"]`)
    btn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedHour])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F7F6FF' }}>

      {/* ── 상단 헤더 ── */}
      <div style={{
        background: 'white',
        padding: '16px 20px 0',
        boxShadow: '0 1px 0 #EBEBF0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#6C5CE7', padding: 0, lineHeight: 1,
            }}
            aria-label="홈으로 돌아가기"
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E' }}>일주기 리듬 가이드</div>
            <div style={{ fontSize: 12, color: '#A0A0B8', marginTop: 1 }}>시간별 신체 상태와 최적 행동</div>
          </div>
        </div>

        {/* ── 시간 탭 (IonSegment) ── */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 12 }}>
          <IonSegment
            ref={segmentRef}
            value={String(selectedHour)}
            scrollable
            onIonChange={e => {
              const v = Number(e.detail.value)
              if (!isNaN(v)) setSelectedHour(v)
            }}
            style={{
              '--background': 'transparent',
              minWidth: 'max-content',
            } as React.CSSProperties}
          >
            {HOURS.map(h => {
              const d = CIRCADIAN_DATA.find(x => x.hour === h)!
              const c = PHASE_COLORS[d.phase]
              const isActive = h === selectedHour
              return (
                <IonSegmentButton
                  key={h}
                  value={String(h)}
                  data-hour={h}
                  style={{
                    '--color': isActive ? c.accent : '#A0A0B8',
                    '--color-checked': c.accent,
                    '--indicator-color': c.accent,
                    '--border-radius': '12px',
                    minWidth: 56,
                    '--padding-start': '8px',
                    '--padding-end': '8px',
                  } as React.CSSProperties}
                >
                  <IonLabel style={{ fontSize: 12, fontWeight: isActive ? 700 : 500 }}>
                    {String(h).padStart(2, '0')}시
                  </IonLabel>
                </IonSegmentButton>
              )
            })}
          </IonSegment>
        </div>
      </div>

      {/* ── 본문 스크롤 영역 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>

        {/* ── 헤더 카드 ── */}
        <div style={{
          background: colors.bg,
          borderRadius: 16,
          padding: '20px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: colors.text, marginBottom: 4 }}>
                {String(data.hour).padStart(2, '0')}:00
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: colors.accent }}>
                {data.phaseName}
              </div>
              <div style={{ fontSize: 13, color: colors.text, opacity: 0.7, marginTop: 2 }}>
                {data.stateName}
              </div>
            </div>
            {/* 에너지 레벨 배지 */}
            <span style={{
              fontSize: 12, fontWeight: 700,
              background: colors.accent, color: 'white',
              padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              {data.energyLevel}
            </span>
          </div>

          {/* 호르몬 태그 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.hormones.map((h, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 600,
                background: 'rgba(0,0,0,0.08)', color: colors.text,
                padding: '4px 10px', borderRadius: 20,
              }}>
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* ── 권장 행동 ── */}
        <Section title="✅ 지금 할 일">
          {data.actions.map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              paddingBottom: i < data.actions.length - 1 ? 14 : 0,
              borderBottom: i < data.actions.length - 1 ? '1px solid #F0EFF8' : 'none',
              marginBottom: i < data.actions.length - 1 ? 14 : 0,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: colors.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 700,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E1E2E', marginBottom: 4 }}>
                  {a.label}
                </div>
                <div style={{ fontSize: 12, color: '#6E6E8A', lineHeight: 1.6 }}>
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
                display: 'flex', gap: 12, alignItems: 'flex-start',
                paddingBottom: i < data.warnings.length - 1 ? 14 : 0,
                borderBottom: i < data.warnings.length - 1 ? '1px solid #FFE8E8' : 'none',
                marginBottom: i < data.warnings.length - 1 ? 14 : 0,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: '#FF7675',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 14,
                }}>
                  ✕
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#C0392B', marginBottom: 4 }}>
                    {w.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#E07070', lineHeight: 1.6 }}>
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
                <IonAccordion key={i} value={String(i)} style={{ '--border-radius': '12px' } as React.CSSProperties}>
                  <IonItem slot="header" lines="none" style={{
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--inner-padding-end': '0',
                  } as React.CSSProperties}>
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      gap: 8, width: '100%', padding: '4px 0',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E1E2E', flex: 1, lineHeight: 1.5 }}>
                        {s.claim}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, flexShrink: 0,
                        background: meta.bg, color: meta.color,
                        padding: '3px 8px', borderRadius: 20,
                        alignSelf: 'flex-start', marginTop: 2,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                  </IonItem>
                  <div slot="content" style={{
                    fontSize: 12, color: '#6E6E8A', lineHeight: 1.7,
                    padding: '8px 0 12px',
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#A0A0B8', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 }}>
        {title}
      </div>
      <div style={{
        background: 'white', borderRadius: 16,
        padding: '16px 18px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        {children}
      </div>
    </div>
  )
}
