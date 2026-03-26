import { useState } from 'react'
import { getSettings, saveSettings } from '../utils/storage'
import { requestNotificationPermission } from '../utils/notifications'

const STEPS = ['환영', '기상 시간', '취침 시간', '알림 설정', '완료']

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [wakeTime, setWakeTime] = useState('07:00')
  const [sleepTime, setSleepTime] = useState('23:00')
  const [permStatus, setPermStatus] = useState('default')

  const next = () => setStep(s => s + 1)

  const handlePermission = async () => {
    const result = await requestNotificationPermission()
    setPermStatus(result)
    next()
  }

  const handleComplete = () => {
    const settings = getSettings()
    // Update default alarm times to match user's wake/sleep times
    const updatedAlarms = settings.alarms.map(a => {
      if (a.id === 1) return { ...a, time: wakeTime }
      if (a.id === 6) return { ...a, time: adjustTime(sleepTime, -30) }
      return a
    })
    saveSettings({
      ...settings,
      onboardingComplete: true,
      wakeTime,
      sleepTime,
      alarms: updatedAlarms,
    })
    onComplete()
  }

  return (
    <div className="onboarding-page">
      {step === 0 && <WelcomeStep onNext={next} />}
      {step === 1 && <WakeTimeStep value={wakeTime} onChange={setWakeTime} onNext={next} />}
      {step === 2 && <SleepTimeStep value={sleepTime} onChange={setSleepTime} onNext={next} />}
      {step === 3 && <NotifStep status={permStatus} onRequest={handlePermission} onSkip={next} />}
      {step === 4 && <DoneStep wakeTime={wakeTime} sleepTime={sleepTime} onComplete={handleComplete} />}
    </div>
  )
}

function adjustTime(time, deltaMinutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + deltaMinutes
  const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60)
  const nm = ((total % 1440) + 1440) % 1440 % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function StepDots({ current, total }) {
  return (
    <div className="step-dots">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`step-dot${i === current ? ' active' : ''}`} />
      ))}
    </div>
  )
}

function WelcomeStep({ onNext }) {
  return (
    <>
      <div className="onboarding-hero">
        <div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10, letterSpacing: -0.5 }}>
          Body Rhythm
        </h1>
        <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.6, maxWidth: 280 }}>
          규칙적인 생활 리듬으로<br />더 건강한 하루를 만들어요
        </p>
      </div>
      <div className="onboarding-body">
        <div style={{ background: '#F5F4FF', borderRadius: 16, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { icon: '🌅', text: '기상·취침 알람으로 규칙적인 수면' },
            { icon: '🥗', text: '식사·운동 알람으로 건강한 루틴' },
            { icon: '📊', text: '실천율 통계로 나의 리듬 확인' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: 14, color: '#4A4A6A', fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
        <StepDots current={0} total={5} />
      </div>
      <div className="onboarding-footer">
        <button className="btn btn-primary btn-full" onClick={onNext}>
          시작하기
        </button>
      </div>
    </>
  )
}

function WakeTimeStep({ value, onChange, onNext }) {
  return (
    <>
      <div className="onboarding-hero">
        <div style={{ fontSize: 56, marginBottom: 14 }}>🌅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>기상 시간</h2>
        <p style={{ fontSize: 15, opacity: 0.85 }}>보통 몇 시에 일어나시나요?</p>
      </div>
      <div className="onboarding-body">
        <div className="card" style={{ width: '100%', padding: '24px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#6E6E8A', marginBottom: 12, fontWeight: 600 }}>기상 시간</p>
          <input
            type="time"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="input input-time"
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: 13, color: '#6E6E8A', marginTop: 10 }}>
            이 시간에 기상 알람이 울립니다
          </p>
        </div>
        <StepDots current={1} total={5} />
      </div>
      <div className="onboarding-footer">
        <button className="btn btn-primary btn-full" onClick={onNext}>다음</button>
      </div>
    </>
  )
}

function SleepTimeStep({ value, onChange, onNext }) {
  return (
    <>
      <div className="onboarding-hero">
        <div style={{ fontSize: 56, marginBottom: 14 }}>🌙</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>취침 시간</h2>
        <p style={{ fontSize: 15, opacity: 0.85 }}>보통 몇 시에 주무시나요?</p>
      </div>
      <div className="onboarding-body">
        <div className="card" style={{ width: '100%', padding: '24px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#6E6E8A', marginBottom: 12, fontWeight: 600 }}>취침 시간</p>
          <input
            type="time"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="input input-time"
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: 13, color: '#6E6E8A', marginTop: 10 }}>
            취침 30분 전에 알림을 보내드립니다
          </p>
        </div>
        <StepDots current={2} total={5} />
      </div>
      <div className="onboarding-footer">
        <button className="btn btn-primary btn-full" onClick={onNext}>다음</button>
      </div>
    </>
  )
}

function NotifStep({ status, onRequest, onSkip }) {
  return (
    <>
      <div className="onboarding-hero">
        <div style={{ fontSize: 56, marginBottom: 14 }}>🔔</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>알림 권한</h2>
        <p style={{ fontSize: 15, opacity: 0.85 }}>알람을 받으려면 알림을 허용해주세요</p>
      </div>
      <div className="onboarding-body">
        {status === 'granted' ? (
          <div style={{ background: '#E6FBF5', borderRadius: 14, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <p style={{ color: '#00B894', fontWeight: 600 }}>알림이 허용되었습니다!</p>
          </div>
        ) : status === 'denied' ? (
          <div style={{ background: '#FFF0F0', borderRadius: 14, padding: 20 }}>
            <p style={{ color: '#FF7675', fontWeight: 600, marginBottom: 6 }}>알림이 차단되었습니다</p>
            <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>
              브라우저 설정 &gt; 사이트 설정에서<br />알림을 허용해주세요
            </p>
          </div>
        ) : (
          <div style={{ background: '#F5F4FF', borderRadius: 14, padding: 20 }}>
            <p style={{ color: '#6C5CE7', fontWeight: 600, marginBottom: 8 }}>알림을 허용하면?</p>
            <ul style={{ color: '#6E6E8A', fontSize: 14, lineHeight: 1.8, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>🔔 기상·취침 알람 수신</li>
              <li>🥗 식사·운동 알림 수신</li>
              <li>⚠️ 앱이 열려 있을 때만 동작합니다</li>
            </ul>
          </div>
        )}
        <StepDots current={3} total={5} />
      </div>
      <div className="onboarding-footer">
        {status !== 'granted' && status !== 'denied' && (
          <button className="btn btn-primary btn-full" onClick={onRequest}>
            알림 허용하기
          </button>
        )}
        <button className="btn btn-ghost btn-full" onClick={onSkip} style={{ fontSize: 14, color: '#A0A0B8' }}>
          {status === 'granted' ? '다음으로' : '나중에 설정하기'}
        </button>
      </div>
    </>
  )
}

function DoneStep({ wakeTime, sleepTime, onComplete }) {
  const fmt = (t) => {
    const [h, m] = t.split(':').map(Number)
    const p = h < 12 ? '오전' : '오후'
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${p} ${hh}:${String(m).padStart(2, '0')}`
  }
  return (
    <>
      <div className="onboarding-hero">
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>모두 완료!</h2>
        <p style={{ fontSize: 15, opacity: 0.85 }}>나만의 리듬을 시작해볼까요?</p>
      </div>
      <div className="onboarding-body">
        <div style={{ background: '#F5F4FF', borderRadius: 16, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row-between">
            <span style={{ fontSize: 14, color: '#6E6E8A', fontWeight: 500 }}>기상 알람</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#6C5CE7' }}>{fmt(wakeTime)}</span>
          </div>
          <div className="row-between">
            <span style={{ fontSize: 14, color: '#6E6E8A', fontWeight: 500 }}>취침 알람</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#6C5CE7' }}>{fmt(sleepTime)}</span>
          </div>
          <div className="row-between">
            <span style={{ fontSize: 14, color: '#6E6E8A', fontWeight: 500 }}>기본 알람</span>
            <span style={{ fontSize: 14, color: '#888' }}>식사 · 운동 포함 6개</span>
          </div>
        </div>
        <StepDots current={4} total={5} />
      </div>
      <div className="onboarding-footer">
        <button className="btn btn-primary btn-full" onClick={onComplete} style={{ fontSize: 17 }}>
          시작하기
        </button>
      </div>
    </>
  )
}
