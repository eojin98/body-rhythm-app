import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodayKey, getRecord, saveRecord, getSettings, formatDate } from '../utils/storage'

// Handle migration from old format (boolean) to new format ({ skipped, time })
function initMeals(saved) {
  const get = (key) => {
    const v = saved?.[key]
    if (v == null) return { skipped: false, time: '' }
    if (typeof v === 'boolean') return { skipped: !v, time: '' }
    return v
  }
  return {
    breakfast: get('breakfast'),
    lunch: get('lunch'),
    dinner: get('dinner'),
    latenight: saved?.latenight ? get('latenight') : { skipped: true, time: '' },
  }
}

const MEAL_DEFAULTS = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '18:30',
  latenight: '21:30',
}

const MEAL_ITEMS = [
  { key: 'breakfast', label: '아침', icon: '🍳' },
  { key: 'lunch',     label: '점심', icon: '🥗' },
  { key: 'dinner',    label: '저녁', icon: '🍚' },
  { key: 'latenight', label: '야식', icon: '🌙' },
]

export default function MorningCheckin() {
  const navigate = useNavigate()
  const today = getTodayKey()
  const existing = getRecord(today) || {}
  const settings = getSettings()

  const [step, setStep] = useState(0)
  const [wakeTime, setWakeTime] = useState(existing.wakeTime || settings.wakeTime)
  const [sleepTime, setSleepTime] = useState(existing.sleepTime || settings.sleepTime)
  const [sleepQuality, setSleepQuality] = useState(existing.sleepQuality || 0)
  const [meals, setMeals] = useState(() => initMeals(existing.meals))
  const [exercise, setExercise] = useState(existing.exercise ?? false)
  const [exerciseStart, setExerciseStart] = useState(existing.exerciseStart || '')
  const [exerciseDuration, setExerciseDuration] = useState(existing.exerciseDuration || '')

  const totalSteps = 4

  const calcWakeOnTime = () => {
    const [th, tm] = settings.wakeTime.split(':').map(Number)
    const [ah, am] = wakeTime.split(':').map(Number)
    return Math.abs((ah * 60 + am) - (th * 60 + tm)) <= 15
  }

  const calcSleepHours = () => {
    const [sh, sm] = sleepTime.split(':').map(Number)
    const [wh, wm] = wakeTime.split(':').map(Number)
    let diff = (wh * 60 + wm) - (sh * 60 + sm)
    if (diff < 0) diff += 24 * 60
    return Math.round(diff / 60 * 10) / 10
  }

  const calcSleepDate = () => {
    const [sh] = sleepTime.split(':').map(Number)
    // If sleep hour >= 12 (PM/evening), sleep was the previous calendar day
    if (sh >= 12) {
      const [y, mo, d] = today.split('-').map(Number)
      const prev = new Date(y, mo - 1, d)
      prev.setDate(prev.getDate() - 1)
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
    }
    return today
  }

  const handleSubmit = () => {
    saveRecord(today, {
      date: today,
      wakeTime,
      wakeDate: today,
      sleepTime,
      sleepDate: calcSleepDate(),
      sleepQuality,
      sleepHours: calcSleepHours(),
      wakeOnTime: calcWakeOnTime(),
      meals,
      exercise,
      exerciseStart: exercise ? exerciseStart : '',
      exerciseDuration: exercise ? exerciseDuration : '',
      completed: true,
      completedAt: new Date().toISOString(),
    })
    navigate('/records')
  }

  const updateMeal = (key, patch) =>
    setMeals(m => {
      const current = m[key]
      // Initialize time with default when un-skipping an empty meal
      if (patch.skipped === false && !current.time) {
        patch = { ...patch, time: MEAL_DEFAULTS[key] }
      }
      return { ...m, [key]: { ...current, ...patch } }
    })

  const progress = ((step + 1) / totalSteps) * 100

  return (
    <div
      className="page-no-nav fade-up"
      style={{ background: 'white', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
        padding: '20px 20px 32px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
        color: 'white',
        position: 'relative',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, color: 'white', padding: '8px 12px', cursor: 'pointer', fontSize: 15 }}
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{formatDate(today)}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>아침 체크인</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.8 }}>
            {step + 1}/{totalSteps}
          </div>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'white', borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ position: 'absolute', bottom: -20, left: 0, right: 0, height: 40, background: '#FAFAFA', borderRadius: '20px 20px 0 0' }} />
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 24px', background: '#FAFAFA' }}>
        {step === 0 && (
          <StepSleep
            wakeTime={wakeTime}
            sleepTime={sleepTime}
            onWakeChange={setWakeTime}
            onSleepChange={setSleepTime}
            sleepHours={calcSleepHours()}
            onTime={calcWakeOnTime()}
          />
        )}
        {step === 1 && (
          <StepQuality value={sleepQuality} onChange={setSleepQuality} />
        )}
        {step === 2 && (
          <StepMeals meals={meals} onUpdate={updateMeal} />
        )}
        {step === 3 && (
          <StepExercise
            exercise={exercise}
            onSet={setExercise}
            exerciseStart={exerciseStart}
            onStartChange={setExerciseStart}
            exerciseDuration={exerciseDuration}
            onDurationChange={setExerciseDuration}
          />
        )}
      </div>

      {/* Bottom button */}
      <div style={{ padding: '16px 20px', paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))', background: '#FAFAFA', borderTop: '1px solid #EEE', flexShrink: 0 }}>
        {step < totalSteps - 1 ? (
          <button className="btn btn-primary btn-full" onClick={() => setStep(s => s + 1)}>
            다음
          </button>
        ) : (
          <button className="btn btn-primary btn-full" onClick={handleSubmit}>
            체크인 완료 🎉
          </button>
        )}
      </div>
    </div>
  )
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({ value, onChange, defaultValue = '12:00' }) {
  const displayVal = value || defaultValue
  const [h24, m] = displayVal.split(':').map(Number)
  const isPM = h24 >= 12
  const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24

  const commit = (newH24, newM) => {
    onChange(`${String(newH24).padStart(2, '0')}:${String(newM).padStart(2, '0')}`)
  }

  const setAMPM = (toPM) => {
    if (toPM === isPM) return
    const newH = toPM
      ? (hour12 === 12 ? 12 : hour12 + 12)
      : (hour12 === 12 ? 0 : hour12)
    commit(newH, m)
  }

  const handleHour = (val) => {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 1 || n > 12) return
    const newH24 = isPM ? (n === 12 ? 12 : n + 12) : (n === 12 ? 0 : n)
    commit(newH24, m)
  }

  const handleMinute = (val) => {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 0 || n > 59) return
    commit(h24, n)
  }

  const numStyle = {
    width: 60, height: 54, textAlign: 'center', fontSize: 24, fontWeight: 700,
    border: '2px solid #E0DFFF', borderRadius: 12, outline: 'none',
    background: '#F5F4FF', color: '#1E1E2E', fontFamily: 'inherit',
    MozAppearance: 'textfield',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {/* AM/PM segmented toggle */}
      <div style={{
        display: 'flex', borderRadius: 12, overflow: 'hidden',
        border: '2px solid #6C5CE7', flexShrink: 0,
      }}>
        {[['오전', false], ['오후', true]].map(([lbl, pm]) => (
          <button
            key={lbl}
            type="button"
            onClick={() => setAMPM(pm)}
            style={{
              padding: '0 14px', height: 54, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
              background: isPM === pm ? '#6C5CE7' : 'white',
              color: isPM === pm ? 'white' : '#6C5CE7',
              transition: 'background 0.15s, color 0.15s',
              userSelect: 'none',
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
      {/* HH : MM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          min={1}
          max={12}
          value={hour12}
          onChange={e => handleHour(e.target.value)}
          style={numStyle}
        />
        <span style={{ fontSize: 26, fontWeight: 800, color: '#6C5CE7', lineHeight: 1, userSelect: 'none' }}>:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={m}
          onChange={e => handleMinute(e.target.value)}
          style={numStyle}
        />
      </div>
    </div>
  )
}

// ─── Step 1: 수면 ─────────────────────────────────────────────────────────────

function StepSleep({ wakeTime, sleepTime, onWakeChange, onSleepChange, sleepHours, onTime }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>수면 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>어젯밤 수면 시간을 입력해주세요</p>
      </div>
      <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="input-label" style={{ marginBottom: 10 }}>취침 시간 (어제 밤)</div>
          <TimePicker value={sleepTime} onChange={onSleepChange} defaultValue="23:00" />
        </div>
        <div style={{ height: 1, background: '#EEE' }} />
        <div>
          <div className="input-label" style={{ marginBottom: 10 }}>기상 시간 (오늘 아침)</div>
          <TimePicker value={wakeTime} onChange={onWakeChange} defaultValue="07:00" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="card card-body" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#6C5CE7' }}>{sleepHours}h</div>
          <div style={{ fontSize: 12, color: '#6E6E8A', marginTop: 2 }}>수면 시간</div>
        </div>
        <div className="card card-body" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: onTime ? '#00B894' : '#FF7675' }}>
            {onTime ? '👍' : '👎'}
          </div>
          <div style={{ fontSize: 12, color: '#6E6E8A', marginTop: 2 }}>
            {onTime ? '제 시간 기상' : '늦은 기상'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: 수면 질 ──────────────────────────────────────────────────────────

function StepQuality({ value, onChange }) {
  const labels = ['', '매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>수면 질</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>어젯밤 수면의 질은 어땠나요?</p>
      </div>
      <div style={{ fontSize: 64 }}>
        {value === 0 ? '😶' : value === 1 ? '😫' : value === 2 ? '😕' : value === 3 ? '😐' : value === 4 ? '😊' : '😄'}
      </div>
      <div className="stars">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className={`star-btn${n <= value ? ' active' : ''}`} onClick={() => onChange(n)}>⭐</button>
        ))}
      </div>
      {value > 0 && (
        <div style={{ padding: '10px 24px', background: '#F5F4FF', borderRadius: 12, color: '#6C5CE7', fontWeight: 600, fontSize: 15 }}>
          {labels[value]}
        </div>
      )}
    </div>
  )
}

// ─── Step 3: 식사 ─────────────────────────────────────────────────────────────

function StepMeals({ meals, onUpdate }) {
  const eatenCount = MEAL_ITEMS.filter(({ key }) => !meals[key].skipped).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>식사 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>각 식사의 시작 시간을 기록해주세요</p>
      </div>
      <div className="card">
        {MEAL_ITEMS.map(({ key, label, icon }, i) => {
          const meal = meals[key]
          return (
            <div
              key={key}
              style={{
                padding: '16px 20px',
                borderBottom: i < MEAL_ITEMS.length - 1 ? '1px solid #F0EFF8' : 'none',
              }}
            >
              {/* Row: icon + label + 먹었어요/안 먹었어요 toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: meal.skipped ? 0 : 14 }}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{label}</span>
                <button
                  type="button"
                  onClick={() => onUpdate(key, { skipped: !meal.skipped })}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13,
                    background: meal.skipped ? 'rgba(255,118,117,0.1)' : 'rgba(108,92,231,0.1)',
                    color: meal.skipped ? '#FF7675' : '#6C5CE7',
                    transition: 'all 0.15s',
                    userSelect: 'none',
                  }}
                >
                  {meal.skipped ? '안 먹었어요' : '먹었어요'}
                </button>
              </div>
              {/* TimePicker — only when not skipped */}
              {!meal.skipped && (
                <TimePicker
                  value={meal.time}
                  onChange={v => onUpdate(key, { time: v })}
                  defaultValue={MEAL_DEFAULTS[key]}
                />
              )}
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: '#A0A0B8' }}>
        {eatenCount}끼 식사 완료
      </div>
    </div>
  )
}

// ─── Step 4: 운동 ─────────────────────────────────────────────────────────────

function StepExercise({ exercise, onSet, exerciseStart, onStartChange, exerciseDuration, onDurationChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>운동 기록</h2>
        <p style={{ fontSize: 14, color: '#6E6E8A' }}>오늘 운동을 하셨나요?</p>
      </div>

      {/* 했어요 / 안 했어요 toggle */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => onSet(true)}
          style={{
            flex: 1, padding: '20px 12px', borderRadius: 16,
            border: '2px solid transparent',
            cursor: 'pointer', fontWeight: 700, fontSize: 15,
            background: exercise ? '#6C5CE7' : '#F5F4FF',
            color: exercise ? 'white' : '#A0A0B8',
            boxShadow: exercise ? '0 4px 16px rgba(108,92,231,0.3)' : 'none',
            transition: 'all 0.2s', userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>💪</div>
          했어요
        </button>
        <button
          type="button"
          onClick={() => onSet(false)}
          style={{
            flex: 1, padding: '20px 12px', borderRadius: 16,
            border: !exercise ? '2px solid rgba(255,118,117,0.4)' : '2px solid transparent',
            cursor: 'pointer', fontWeight: 700, fontSize: 15,
            background: !exercise ? 'rgba(255,118,117,0.08)' : '#F5F4FF',
            color: !exercise ? '#FF7675' : '#A0A0B8',
            transition: 'all 0.2s', userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>🛋️</div>
          안 했어요
        </button>
      </div>

      {/* 운동 상세 — only when exercised */}
      {exercise && (
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div className="input-label" style={{ marginBottom: 10 }}>운동 시작 시간</div>
            <TimePicker value={exerciseStart} onChange={onStartChange} defaultValue="17:00" />
          </div>
          <div style={{ height: 1, background: '#EEE' }} />
          <div className="input-group">
            <label className="input-label">운동한 시간</label>
            <input
              type="text"
              value={exerciseDuration}
              onChange={e => onDurationChange(e.target.value)}
              className="input"
              placeholder="예: 30분, 1시간, 1시간 30분"
            />
          </div>
        </div>
      )}

      {!exercise && (
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <div style={{ fontSize: 14, color: '#A0A0B8' }}>괜찮아요, 내일 운동해요!</div>
        </div>
      )}
    </div>
  )
}
