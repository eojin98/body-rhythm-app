import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRecords } from '../utils/storage'
import {
  getTotalDone, getCurrentStreak, getWeekAvgScore, getTodayScore,
  getWeeklyPracticeRate, getMood, MOODS,
  getStage, getStageProgress, getCharacterImage,
  getAcknowledgedStage, setAcknowledgedStage,
} from '../utils/characterLogic'
import { getTotalPoints, getTodayPoints } from '../utils/pointLedger'

const CHAR_IMG_HEIGHT = 200 // 컨테이너 높이 고정 — 하단 정렬 이미지가 단계/상태별로 바뀌어도 위아래로 튀지 않게

export default function Character() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [records] = useState(() => getRecords())
  const [showEvolveAnim, setShowEvolveAnim] = useState(false)
  const [evolvedStage, setEvolvedStage] = useState(null)
  const [imgError, setImgError] = useState(false)

  const characterId = profile?.character_id ?? null
  const characterName = profile?.character_name ?? ''

  const totalDone = getTotalDone(records)
  const streak = getCurrentStreak(records)
  const weekAvg = getWeekAvgScore(records)
  const todayScore = getTodayScore(records)
  const weeklyRate = getWeeklyPracticeRate(records, user?.created_at)
  const mood = getMood(weeklyRate)
  const moodDef = MOODS.find(m => m.mood === mood) ?? MOODS[MOODS.length - 1]

  // ledger 변경(서버 병합·포인트 적립) 시 포인트/단계 표시 갱신
  const [, setLedgerTick] = useState(0)
  useEffect(() => {
    const refresh = () => setLedgerTick(t => t + 1)
    window.addEventListener('bodyrhythm:ledgerUpdated', refresh)
    window.addEventListener('bodyrhythm:pointRecorded', refresh)
    return () => {
      window.removeEventListener('bodyrhythm:ledgerUpdated', refresh)
      window.removeEventListener('bodyrhythm:pointRecorded', refresh)
    }
  }, [])

  const totalPts = getTotalPoints()
  const todayPts = getTodayPoints()
  const stage = getStage(totalPts)
  const stageProgress = getStageProgress(totalPts)
  const characterImage = getCharacterImage(characterId, stage, mood)

  // characterImage(주소)가 바뀌면(단계/상태 변화 등) 이전 로드 실패 상태를 초기화
  useEffect(() => { setImgError(false) }, [characterImage])

  useEffect(() => {
    const lastStage = getAcknowledgedStage()
    if (stage > lastStage) {
      setEvolvedStage(stage)
      setShowEvolveAnim(true)
      setAcknowledgedStage(stage)
      const t = setTimeout(() => setShowEvolveAnim(false), 2800)
      return () => clearTimeout(t)
    }
  }, [])

  const evolvedImage = evolvedStage != null ? getCharacterImage(characterId, evolvedStage, mood) : null

  return (
    <div className="page fade-up">
      {/* ── Evolution overlay ── */}
      {showEvolveAnim && evolvedStage != null && (
        <div className="evolve-overlay" onClick={() => setShowEvolveAnim(false)}>
          {evolvedImage ? (
            <img
              src={evolvedImage}
              alt=""
              style={{ height: 140, width: 'auto', objectFit: 'contain' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="evolve-emoji">🎉</div>
          )}
          <div className="evolve-title">진화했어요!</div>
          <div className="evolve-sub">{evolvedStage}단계로 성장했어요</div>
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
          <div style={{
            height: CHAR_IMG_HEIGHT, display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', marginBottom: 16,
          }}>
            {characterImage && !imgError ? (
              <img
                src={characterImage}
                alt={characterName || '캐릭터'}
                onError={() => setImgError(true)}
                style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ fontSize: 72, lineHeight: 1, userSelect: 'none' }}>🐾</div>
            )}
          </div>

          <div style={{
            fontSize: 24, fontWeight: 800, color: '#1E1E2E',
            maxWidth: 220, margin: '0 auto', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {characterName || '캐릭터'}
          </div>
        </div>
      </div>

      {/* ── 보유 포인트 카드 ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: '#A0A0B8', marginBottom: 4 }}>보유 포인트</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#6C5CE7', lineHeight: 1 }}>
                {totalPts.toLocaleString()}<span style={{ fontSize: 16, fontWeight: 600, marginLeft: 3 }}>P</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#A0A0B8', marginBottom: 4 }}>오늘 획득</div>
              <div style={{
                fontSize: 18, fontWeight: 700,
                color: todayPts > 0 ? '#00B894' : '#C0C0D0',
              }}>
                {todayPts > 0 ? `+${todayPts}P` : '0P'}
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #F0EFF8', marginTop: 14 }}>
            <button
              onClick={() => navigate('/point-history')}
              style={{
                display: 'block', width: '100%', paddingTop: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'right', fontSize: 13, color: '#6C5CE7',
                fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              포인트 내역 보기 →
            </button>
          </div>
        </div>
      </div>

      {/* ── Condition card (어제까지 7일 실천률 기준) ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1E1E2E' }}>지난 7일 컨디션</span>
            <span style={{ fontSize: 13, color: '#A0A0B8' }}>
              {weeklyRate != null ? `실천률 ${weeklyRate}%` : '집계 전'}
            </span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#6C5CE7', marginBottom: 2 }}>{moodDef.label}</div>
            <div style={{ fontSize: 13, color: '#6E6E8A', lineHeight: 1.5 }}>{moodDef.message}</div>
          </div>
          <div style={{ background: '#F5F5FA', borderRadius: 8, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${weeklyRate ?? 0}%`, height: '100%',
              background: 'linear-gradient(90deg, #6C5CE7, #A29BFE)',
              borderRadius: 8, transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#A0A0B8', marginTop: 8 }}>
            어제까지 7일 기준 · 오늘 기록은 내일 반영돼요
          </div>
        </div>
      </div>

      {/* ── Growth progress ── */}
      <div className="section" style={{ paddingTop: 0 }}>
        {stageProgress.next !== null ? (
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1E1E2E' }}>다음 성장까지</span>
              <span style={{ fontSize: 13, color: '#A0A0B8' }}>{stageProgress.toNext.toLocaleString()}P 남음</span>
            </div>
            <div style={{ background: '#F5F5FA', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                width: `${stageProgress.progress}%`, height: '100%',
                background: 'linear-gradient(90deg, #FDCB6E, #E17055)',
                borderRadius: 8, transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#A0A0B8' }}>현재 {totalPts.toLocaleString()}P</span>
              <span style={{ fontSize: 12, color: '#A0A0B8' }}>목표 {stageProgress.next.toLocaleString()}P</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '18px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#6C5CE7' }}>최고 단계 달성!</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>총 {totalPts.toLocaleString()}P 획득했어요</div>
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
