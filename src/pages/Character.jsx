import { useState, useEffect } from 'react'
import { getRecords, getSettings, saveSettings } from '../utils/storage'
import {
  getTotalDone, getCurrentStreak, getWeekAvgScore, getTodayScore,
  getConditionScore, getCondition, getEvolutionStage, getEvolutionProgress,
  getAcknowledgedStage, setAcknowledgedStage,
} from '../utils/characterLogic'

export default function Character() {
  const [records] = useState(() => getRecords())
  const [settings, setSettings] = useState(() => getSettings())
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showEvolveAnim, setShowEvolveAnim] = useState(false)
  const [evolvedStage, setEvolvedStage] = useState(null)

  const characterName = settings.characterName || '바디'
  const totalDone = getTotalDone(records)
  const streak = getCurrentStreak(records)
  const weekAvg = getWeekAvgScore(records)
  const todayScore = getTodayScore(records)
  const conditionScore = getConditionScore(records)
  const condition = getCondition(conditionScore)
  const stage = getEvolutionStage(totalDone)
  const evo = getEvolutionProgress(totalDone)

  useEffect(() => {
    const lastStage = getAcknowledgedStage()
    if (stage.stage > lastStage) {
      setEvolvedStage(stage)
      setShowEvolveAnim(true)
      setAcknowledgedStage(stage.stage)
      const t = setTimeout(() => setShowEvolveAnim(false), 2800)
      return () => clearTimeout(t)
    }
  }, [])

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    const updated = { ...settings, characterName: trimmed }
    saveSettings(updated)
    setSettings(updated)
    setEditingName(false)
  }

  const startEditName = () => {
    setNameInput(characterName)
    setEditingName(true)
  }

  return (
    <div className="page fade-up">
      {/* ── Evolution overlay ── */}
      {showEvolveAnim && evolvedStage && (
        <div className="evolve-overlay" onClick={() => setShowEvolveAnim(false)}>
          <div className="evolve-emoji">{evolvedStage.emoji}</div>
          <div className="evolve-title">
            {evolvedStage.badge && <span style={{ marginRight: 6 }}>{evolvedStage.badge}</span>}
            진화했어요!
          </div>
          <div className="evolve-sub">{evolvedStage.name}(으)로 성장했어요</div>
          <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>탭하여 닫기</div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-header">
        <div className="header-title">캐릭터</div>
        <div className="header-sub">나의 루틴 파트너</div>
      </div>

      {/* ── Character card ── */}
      <div className="section">
        <div style={{
          background: 'linear-gradient(135deg, #F5F4FF 0%, #EDE9FF 100%)',
          borderRadius: 24, padding: '32px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 16, userSelect: 'none' }}>
            {stage.emoji}
          </div>

          {/* Name row */}
          {editingName ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                maxLength={10}
                autoFocus
                style={{
                  fontSize: 20, fontWeight: 700, textAlign: 'center',
                  border: '2px solid #6C5CE7', borderRadius: 10, padding: '4px 12px',
                  outline: 'none', color: '#1E1E2E', background: 'white', width: 130,
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleSaveName}
                style={{
                  background: '#6C5CE7', color: 'white', border: 'none',
                  borderRadius: 8, padding: '6px 12px', fontWeight: 700,
                  cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                }}
              >저장</button>
              <button
                onClick={() => setEditingName(false)}
                style={{
                  background: '#EEEEEE', color: '#888', border: 'none',
                  borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'inherit',
                }}
              >취소</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#1E1E2E' }}>{characterName}</span>
              <button
                onClick={startEditName}
                style={{
                  background: 'none', border: '1px solid #D0CFEE', borderRadius: 6,
                  padding: '2px 10px', color: '#A0A0B8', cursor: 'pointer',
                  fontSize: 12, fontFamily: 'inherit',
                }}
              >변경</button>
            </div>
          )}

          {/* Stage badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'white', borderRadius: 20, padding: '5px 16px',
            boxShadow: '0 1px 6px rgba(108,92,231,0.15)',
          }}>
            {stage.badge && <span style={{ fontSize: 14 }}>{stage.badge}</span>}
            <span style={{ fontSize: 14, fontWeight: 700, color: '#6C5CE7' }}>{stage.name}</span>
          </div>
          <p style={{ fontSize: 13, color: '#888', marginTop: 10 }}>{stage.description}</p>
        </div>
      </div>

      {/* ── Condition card ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1E1E2E' }}>오늘 컨디션</span>
            <span style={{ fontSize: 13, color: '#A0A0B8' }}>{conditionScore}점</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 30, userSelect: 'none' }}>{condition.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#6C5CE7', marginBottom: 2 }}>{condition.label}</div>
              <div style={{ fontSize: 13, color: '#6E6E8A', lineHeight: 1.5 }}>{condition.message}</div>
            </div>
          </div>
          <div style={{ background: '#F5F5FA', borderRadius: 8, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${conditionScore}%`, height: '100%',
              background: 'linear-gradient(90deg, #6C5CE7, #A29BFE)',
              borderRadius: 8, transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>

      {/* ── Evolution progress ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        {evo.next !== null ? (
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1E1E2E' }}>다음 진화까지</span>
              <span style={{ fontSize: 13, color: '#A0A0B8' }}>앞으로 {evo.toNext}회</span>
            </div>
            <div style={{ background: '#F5F5FA', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                width: `${evo.progress}%`, height: '100%',
                background: 'linear-gradient(90deg, #FDCB6E, #E17055)',
                borderRadius: 8, transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#A0A0B8' }}>현재 {totalDone}회</span>
              <span style={{ fontSize: 12, color: '#A0A0B8' }}>목표 {evo.next}회</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '18px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#6C5CE7' }}>최고 단계 달성!</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>총 {totalDone}번 완료했어요</div>
          </div>
        )}
      </div>

      {/* ── Stats grid ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: '오늘 실천율', value: `${todayScore}%`, icon: '📅', color: '#6C5CE7' },
            { label: '7일 평균',    value: `${weekAvg}%`,    icon: '📊', color: '#00B894' },
            { label: '연속 달성',   value: `${streak}일`,    icon: '🔥', color: '#E17055' },
            { label: '총 완료',     value: `${totalDone}회`, icon: '✅', color: '#FDCB6E' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6, userSelect: 'none' }}>{icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 12, color: '#A0A0B8' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
