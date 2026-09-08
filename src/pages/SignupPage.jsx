import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const NICK_RE = /^[가-힣a-zA-Z0-9]+$/

function koreanSignupError(err) {
  const msg = err?.message || ''
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return '이미 가입된 이메일입니다'
  if (msg.toLowerCase().includes('weak_password') || msg.includes('Password should be at least'))
    return '비밀번호가 조건을 충족하지 않습니다 (영문+숫자, 8자 이상)'
  if (msg.includes('Unable to validate email') || msg.toLowerCase().includes('invalid email'))
    return '이메일 형식이 올바르지 않습니다'
  if (msg.includes('Too many requests') || msg.toLowerCase().includes('rate limit'))
    return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요'
  return msg || '회원가입에 실패했습니다'
}

export default function SignupPage() {
  const { signUp, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [nickname, setNickname] = useState('')
  const [nicknameStatus, setNicknameStatus] = useState('idle') // idle|checking|available|taken|invalid
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const pwLen    = password.length >= 8
  const pwLetter = /[a-zA-Z]/.test(password)
  const pwDigit  = /[0-9]/.test(password)
  const pwOk     = pwLen && pwLetter && pwDigit

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const canSubmit =
    emailOk && pwOk && confirm === password && nicknameStatus === 'available' && !loading

  // Debounced nickname availability check (500 ms)
  useEffect(() => {
    const trimmed = nickname.trim()
    if (!trimmed) { setNicknameStatus('idle'); return }
    if (!NICK_RE.test(trimmed) || trimmed.length < 2 || trimmed.length > 12) {
      setNicknameStatus('invalid'); return
    }
    setNicknameStatus('checking')
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('check_nickname_available', { p_nickname: trimmed })
        setNicknameStatus(data ? 'available' : 'taken')
      } catch {
        setNicknameStatus('idle')
      }
    }, 500)
    return () => clearTimeout(t)
  }, [nickname])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      // 1. Re-check availability at submit (race-condition guard)
      const { data: available } = await supabase.rpc('check_nickname_available', { p_nickname: nickname.trim() })
      if (!available) {
        setNicknameStatus('taken')
        setError('이미 사용 중인 닉네임입니다')
        return
      }

      // 2. Create account
      const { data, error: signUpErr } = await signUp(email.trim(), password)
      if (signUpErr) { setError(koreanSignupError(signUpErr)); return }

      // identities=[] means email already registered (fake-success from Supabase)
      if (data.user?.identities?.length === 0) {
        setError('이미 가입된 이메일입니다')
        return
      }

      // 3a. Auto-login (email confirmation disabled): set nickname immediately
      if (data.session) {
        const { error: nickErr } = await supabase.rpc('set_nickname', { p_nickname: nickname.trim() })
        if (!nickErr) {
          // 오프라인 fallback용 로컬 플래그 기록 (profileError=true 상태와 닉네임 미설정 구분)
          localStorage.setItem(`nicknameSet_${data.user.id}`, '1')
          try { await refreshProfile(data.user.id) } catch {}
          // If refreshProfile succeeded → profile.nickname is set → App.jsx transitions to main app
        }
        // If nickErr → profile.nickname stays null → App.jsx shows NicknameSetupPage on redirect
      } else {
        // 3b. Email confirmation required: can't call set_nickname without a session.
        //     User confirms email → logs in → App.jsx shows NicknameSetupPage → they set nickname there.
        setSuccess(true)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', marginBottom: 10 }}>인증 메일을 보냈어요</div>
          <div style={{ fontSize: 14, color: '#6E6E8A', lineHeight: 1.6, marginBottom: 24 }}>
            <strong>{email}</strong>로 전송된 메일의 링크를 클릭하면 가입이 완료돼요.
          </div>
          <button onClick={() => navigate('/login')} style={primaryBtnStyle(false)}>
            로그인으로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>⏰</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1E1E2E', letterSpacing: -0.5 }}>바디리듬</div>
        <div style={{ fontSize: 13, color: '#A0A0B8', marginTop: 4 }}>일주기 리듬 기반 루틴 알람</div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', marginBottom: 20 }}>회원가입</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 이메일 */}
          <div>
            <label style={labelStyle}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="example@email.com"
              style={inputStyle}
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label style={labelStyle}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="비밀번호 입력"
              style={inputStyle}
            />
            {password.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {[
                  { ok: pwLen,    label: '8자 이상' },
                  { ok: pwLetter, label: '영문 포함' },
                  { ok: pwDigit,  label: '숫자 포함' },
                ].map(({ ok, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <span style={{ color: ok ? '#00B894' : '#C0C0D0' }}>{ok ? '✓' : '○'}</span>
                    <span style={{ color: ok ? '#00B894' : '#A0A0B8' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label style={labelStyle}>비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="비밀번호 재입력"
              style={{
                ...inputStyle,
                borderColor: confirm && confirm !== password ? '#FF7675' : '#E0DEFF',
              }}
            />
            {confirm && confirm !== password && (
              <div style={{ fontSize: 12, color: '#FF7675', marginTop: 4 }}>
                비밀번호가 일치하지 않습니다
              </div>
            )}
          </div>

          {/* 닉네임 */}
          <div>
            <label style={labelStyle}>
              닉네임{' '}
              <span style={{ color: '#A0A0B8', fontWeight: 400 }}>(2~12자, 한글·영문·숫자)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              autoComplete="off"
              placeholder="닉네임 입력"
              maxLength={12}
              style={{
                ...inputStyle,
                borderColor:
                  nicknameStatus === 'taken' || nicknameStatus === 'invalid'
                    ? '#FF7675'
                    : nicknameStatus === 'available'
                    ? '#00B894'
                    : '#E0DEFF',
              }}
            />
            {nickname.trim().length > 0 && (
              <div style={{
                fontSize: 12, marginTop: 4,
                color:
                  nicknameStatus === 'available' ? '#00B894'
                  : nicknameStatus === 'taken' || nicknameStatus === 'invalid' ? '#FF7675'
                  : '#A0A0B8',
              }}>
                {nicknameStatus === 'available' ? '✓ 사용 가능한 닉네임입니다'
               : nicknameStatus === 'taken'     ? '✗ 이미 사용 중인 닉네임입니다'
               : nicknameStatus === 'invalid'   ? '✗ 2~12자, 한글·영문·숫자만 사용 가능합니다'
               : nicknameStatus === 'checking'  ? '확인 중…'
               : ''}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: '#FFF0F0',
              borderRadius: 10, fontSize: 13, color: '#FF7675', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={!canSubmit} style={primaryBtnStyle(!canSubmit)}>
            {loading ? '가입 중…' : '회원가입'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#A0A0B8' }}>
          이미 계정이 있으신가요?{' '}
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: '#6C5CE7', fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
          >
            로그인
          </button>
        </div>
      </div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)', padding: '24px',
}

const cardStyle = {
  width: '100%', maxWidth: 380,
  background: '#fff', borderRadius: 24,
  padding: '28px 24px',
  boxShadow: '0 4px 24px rgba(108,92,231,0.10)',
}

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: '#6E6E8A',
  display: 'block', marginBottom: 6,
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 14px', borderRadius: 12,
  border: '1.5px solid #E0DEFF', fontSize: 14,
  color: '#1E1E2E', background: '#FAFAFE',
  outline: 'none', fontFamily: 'inherit',
}

const primaryBtnStyle = (disabled) => ({
  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
  background: disabled ? '#C9C3F5' : 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
  color: '#fff', fontSize: 15, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: 4, fontFamily: 'inherit',
})
