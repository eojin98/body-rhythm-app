import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { setCurrentUser } from '../utils/pointLedger'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null)
  const [loading, setLoading]               = useState(true)
  const [profile, setProfile]               = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  // true = 조회 자체가 실패(네트워크 오류). null row와 구분해 오프라인 시 앱 진입 허용.
  const [profileError, setProfileError]     = useState(false)

  // onAuthStateChange 콜백(클로저)이 항상 최신 user id를 보도록 ref로 추적.
  // TOKEN_REFRESHED처럼 같은 사용자의 세션이 갱신될 때는 profileLoading을 건드리지 않기 위함.
  const userIdRef = useRef(null)

  const refreshProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); setProfileError(false); return }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, character_id, character_name')
        .eq('id', uid)
        .maybeSingle()
      if (error) throw error            // network / PostgREST error
      setProfile(data)                  // null = row missing (new user); { nickname } = set
      setProfileError(false)
    } catch {
      // 네트워크 실패 — 기존 profile 상태 유지, 오프라인 플래그 세팅
      // App.jsx 게이트: !profile?.nickname && !profileError → 오프라인이면 통과
      setProfileError(true)
    }
  }, [])

  useEffect(() => {
    const sessionPromise = supabase.auth.getSession()

    // 네트워크 무응답 시 로딩 화면에서 영구 정지하는 것을 막기 위한 8초 타임아웃.
    // sessionPromise 자체는 백그라운드에서 계속 진행되므로, 타임아웃 이후에 실제 응답이
    // 오면 아래 sessionPromise.then(...)이 그대로 처리해 세션을 정상 복원한다.
    const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 8000))
    Promise.race([sessionPromise, timeout]).then(result => {
      if (result === 'timeout') {
        console.warn('[AuthContext] getSession() 8초 타임아웃 — 비로그인 상태로 진행')
        userIdRef.current = null
        setCurrentUser(null)
        setUser(null)
        setProfileLoading(false)
        setLoading(false)
      }
    })

    sessionPromise
      .then(({ data: { session } }) => {
        userIdRef.current = session?.user?.id ?? null
        setCurrentUser(session?.user?.id ?? null)
        setUser(session?.user ?? null)
        // If no user, profile fetch is unnecessary — unblock the loading screen now.
        // If user exists, profileLoading stays true (initial) until the fetch useEffect resolves.
        if (!session?.user) setProfileLoading(false)
      })
      .catch(() => { userIdRef.current = null; setCurrentUser(null); setUser(null); setProfileLoading(false) })
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null
      // 직전 id와 다를 때만(진짜 로그인/계정 전환) 프로필을 다시 불러와야 한다.
      // 같은 사용자의 세션 갱신(TOKEN_REFRESHED 등)에서는 id가 그대로이므로 건드리지 않는다 —
      // 안 그러면 profileLoading을 false로 되돌리는 effect(아래, user?.id 변경에만 반응)가
      // 재실행되지 않아 profileLoading이 영구히 true로 남는다.
      const userIdChanged = newUserId !== userIdRef.current
      userIdRef.current = newUserId

      setCurrentUser(newUserId)
      setUser(session?.user ?? null)
      // Batch with setUser so there's no render where user is set but profileLoading is stale.
      if (!session?.user) {
        setProfile(null)
        setProfileLoading(false)
        setProfileError(false)
      } else if (userIdChanged) {
        setProfileLoading(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile whenever the logged-in user changes (login / account switch)
  useEffect(() => {
    if (!user) return
    refreshProfile(user.id).finally(() => setProfileLoading(false))
  }, [user?.id, refreshProfile])

  // 안전장치: profileLoading이 true가 된 뒤 10초가 지나도 false로 안 돌아오면 강제 해제.
  // 정상 흐름(refreshProfile 완료)에서는 그 전에 profileLoading이 false가 되어 아래
  // cleanup이 이 타이머를 지우므로, 이 setTimeout은 발동하지 않아야 한다.
  useEffect(() => {
    if (!profileLoading) return
    const timer = setTimeout(() => {
      console.warn('[AuthContext] profileLoading이 10초 넘게 true로 남아있어 강제로 false 전환합니다.')
      setProfileLoading(false)
    }, 10000)
    return () => clearTimeout(timer)
  }, [profileLoading])

  // 오프라인 실패 후 앱이 포그라운드로 돌아오면 자동 재시도
  useEffect(() => {
    if (!user || !profileError) return
    const handleVisible = () => {
      if (document.visibilityState === 'visible') refreshProfile(user.id)
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [user, profileError, refreshProfile])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, loading, profile, profileLoading, profileError, refreshProfile, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
