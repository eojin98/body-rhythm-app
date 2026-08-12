import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ERR_MAP = {
  'User already registered': '이미 등록된 이메일입니다',
  'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다',
  'Unable to validate email address': '올바른 이메일 형식이 아닙니다',
  'Too many requests': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
}
function koreanError(msg) {
  for (const [en, ko] of Object.entries(ERR_MAP)) {
    if (msg?.includes(en)) return ko
  }
  return msg || '회원가입에 실패했습니다'
}

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)
  const [loading, setLoading]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('비밀번호 확인이 일치하지 않습니다')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await signUp(email.trim(), password)
      if (error) {
        setError(koreanError(error.message))
      } else if (data?.user && !data.session) {
        // 이메일 인증 필요 (Supabase 대시보드에서 'Confirm email' 활성화 시)
        setSuccess(true)
      }
      // 이메일 인증 불필요 설정이면 onAuthStateChange가 user를 세팅 → App이 자동 전환
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: '0 24px',
      }}>
        <div style={{
          width: '100%', maxWidth: 380, background: '#fff',
          borderRadius: 24, padding: '32px 24px',
          boxShadow: '0 4px 24px rgba(108,92,231,0.10)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', marginBottom: 10 }}>인증 메일을 보냈어요</div>
          <div style={{ fontSize: 14, color: '#6E6E8A', lineHeight: 1.6, marginBottom: 24 }}>
            <strong>{email}</strong>로 전송된 메일의 링크를 클릭하면 가입이 완료돼요.
          </div>
          <button
            onClick={() => navigate('/login')}
            style={primaryBtnStyle(false)}
          >
            로그인으로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '0 24px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>⏰</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1E1E2E', letterSpacing: -0.5 }}>바디리듬</div>
        <div style={{ fontSize: 13, color: '#A0A0B8', marginTop: 4 }}>일주기 리듬 기반 루틴 알람</div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#fff', borderRadius: 24,
        padding: '28px 24px',
        boxShadow: '0 4px 24px rgba(108,92,231,0.10)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', marginBottom: 20 }}>
          회원가입
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6E6E8A', display: 'block', marginBottom: 6 }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="example@email.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6E6E8A', display: 'block', marginBottom: 6 }}>비밀번호 <span style={{ color: '#A0A0B8', fontWeight: 400 }}>(6자 이상)</span></label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="비밀번호 입력"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6E6E8A', display: 'block', marginBottom: 6 }}>비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="비밀번호 재입력"
              style={{
                ...inputStyle,
                borderColor: confirm && confirm !== password ? '#FF7675' : '#E0DEFF',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: '#FFF0F0', borderRadius: 10,
              fontSize: 13, color: '#FF7675', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={primaryBtnStyle(loading)}
          >
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
  color: '#fff', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: 4, fontFamily: 'inherit',
})
