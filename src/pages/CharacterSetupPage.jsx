import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const CHARACTERS = [
  { id: 1, name: '고양이' },
  { id: 2, name: '수달' },
  { id: 3, name: '토끼' },
  { id: 4, name: '카피바라' },
]

export default function CharacterSetupPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Android 뒤로가기 삼키기: 캐릭터 설정 전에는 앱에 진입할 수 없음
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapApp.addListener('backButton', () => { /* swallow — no exit from this screen */ })
    return () => { sub.then(h => h.remove()) }
  }, [])

  const trimmedName = name.trim()
  const canSubmit = selectedId != null && trimmedName.length >= 1 && trimmedName.length <= 10 && !loading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      const { error: charErr } = await supabase.rpc('set_character', {
        p_character_id: selectedId,
        p_character_name: trimmedName,
      })
      if (charErr) {
        const msg = charErr.message || ''
        if (msg.includes('CHARACTER_NAME_LENGTH')) {
          setError('이름은 1~10자로 입력해주세요')
        } else if (msg.includes('CHARACTER_INVALID')) {
          setError('캐릭터를 선택해주세요')
        } else {
          setError('저장에 실패했습니다. 다시 시도해주세요')
        }
        return
      }

      // set_character 성공 — 오프라인 fallback용 로컬 플래그 기록
      // (NicknameSetupPage의 nicknameSet_{id} 플래그와 동일한 패턴)
      localStorage.setItem(`characterSet_${user.id}`, '1')
      // profile을 다시 불러와 App.jsx의 캐릭터 게이트를 통과시킨 뒤 홈으로 이동
      await refreshProfile(user.id)
      navigate('/', { replace: true })
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>🐾</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', marginBottom: 6 }}>
          함께할 캐릭터를 골라주세요
        </div>
        <div style={{ fontSize: 13, color: '#6E6E8A', lineHeight: 1.6 }}>
          나의 루틴을 함께 키워나갈 캐릭터예요.
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{
          padding: '8px 12px', marginBottom: 18,
          background: '#FFF8E6', borderRadius: 10,
          fontSize: 12, color: '#B8860B', fontWeight: 600, textAlign: 'center',
        }}>
          ⚠️ 한 번 선택하면 변경할 수 없습니다
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={gridStyle}>
            {CHARACTERS.map(c => {
              const isSelected = selectedId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  style={cardBtnStyle(isSelected)}
                >
                  <img
                    src={`/characters/char${c.id}_s3_m2.webp`}
                    alt={c.name}
                    style={{ width: '100%', maxWidth: 100, height: 'auto', display: 'block', margin: '0 auto' }}
                  />
                  <div style={{
                    marginTop: 8, fontSize: 14, fontWeight: 700,
                    color: isSelected ? '#6C5CE7' : '#1E1E2E',
                  }}>
                    {c.name}
                  </div>
                </button>
              )
            })}
          </div>

          <div>
            <label style={labelStyle}>
              캐릭터 이름 <span style={{ color: '#A0A0B8', fontWeight: 400 }}>(1~10자)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="off"
              placeholder="캐릭터 이름 입력"
              maxLength={10}
              style={inputStyle}
            />
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
            {loading ? '저장 중…' : '시작하기'}
          </button>
        </form>
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
  padding: '24px 20px',
  boxShadow: '0 4px 24px rgba(108,92,231,0.10)',
}

const gridStyle = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
}

const cardBtnStyle = (selected) => ({
  padding: '14px 10px 12px',
  borderRadius: 16,
  border: selected ? '2px solid #6C5CE7' : '2px solid #E0DEFF',
  background: selected ? '#F5F4FF' : '#FAFAFE',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.15s',
})

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
