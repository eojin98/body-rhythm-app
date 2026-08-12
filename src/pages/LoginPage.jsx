import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ERR_MAP = {
  'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다',
  'Email not confirmed': '이메일 인증이 필요합니다. 메일함을 확인해주세요',
  'Too many requests': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
}
function koreanError(msg) {
  for (const [en, ko] of Object.entries(ERR_MAP)) {
    if (msg?.includes(en)) return ko
  }
  return msg || '로그인에 실패했습니다'
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        setError(koreanError(error.message))
      }
      // 성공 시 AuthContext의 onAuthStateChange가 user를 업데이트하고
      // App.jsx의 guard가 자동으로 메인 앱으로 전환
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
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
          로그인
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
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6E6E8A', display: 'block', marginBottom: 6 }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="비밀번호 입력"
              style={inputStyle}
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
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#A0A0B8' }}>
          계정이 없으신가요?{' '}
          <button
            onClick={() => navigate('/signup')}
            style={{ background: 'none', border: 'none', color: '#6C5CE7', fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
          >
            회원가입
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
