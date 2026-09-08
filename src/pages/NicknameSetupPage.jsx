import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const NICK_RE = /^[가-힣a-zA-Z0-9]+$/

export default function NicknameSetupPage() {
  const { user, refreshProfile, signOut } = useAuth()
  const [nickname, setNickname] = useState('')
  const [nicknameStatus, setNicknameStatus] = useState('idle') // idle|checking|available|taken|invalid
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Android 뒤로가기 삼키기: 닉네임 설정 전에는 앱에 진입할 수 없음
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapApp.addListener('backButton', () => { /* swallow — no exit from this screen */ })
    return () => { sub.then(h => h.remove()) }
  }, [])

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

  const canSubmit = nicknameStatus === 'available' && !loading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      // Re-check at submit (race-condition guard)
      const { data: available } = await supabase.rpc('check_nickname_available', { p_nickname: nickname.trim() })
      if (!available) {
        setNicknameStatus('taken')
        setError('이미 사용 중인 닉네임입니다')
        return
      }

      const { error: nickErr } = await supabase.rpc('set_nickname', { p_nickname: nickname.trim() })
      if (nickErr) {
        const msg = nickErr.message || ''
        if (msg.includes('NICKNAME_TAKEN') || msg.includes('23505')) {
          setNicknameStatus('taken')
          setError('이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요')
        } else if (msg.includes('NICKNAME_LENGTH') || msg.includes('NICKNAME_FORMAT')) {
          setError('닉네임 형식이 올바르지 않습니다 (2~12자, 한글·영문·숫자)')
        } else {
          setError('닉네임 설정에 실패했습니다. 잠시 후 다시 시도해주세요')
        }
        return
      }

      // set_nickname 성공 — 오프라인 fallback용 로컬 플래그 기록
      // (profileError=true 상태에서 앱 재시작 시 닉네임 미설정 계정과 구분)
      localStorage.setItem(`nicknameSet_${user.id}`, '1')
      // Success: update profile state → App.jsx re-renders to main app
      await refreshProfile(user.id)
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>⏰</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1E1E2E', letterSpacing: -0.5 }}>바디리듬</div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', marginBottom: 8 }}>닉네임 설정</div>
        <div style={{ fontSize: 13, color: '#6E6E8A', lineHeight: 1.6, marginBottom: 20 }}>
          다른 사용자에게 표시되는 이름을 정해주세요.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              autoFocus
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
            {loading ? '설정 중…' : '완료'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={() => signOut()}
            style={{ background: 'none', border: 'none', color: '#A0A0B8', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            다른 계정으로 로그인
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
