import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id')) {
  console.warn('[supabase] .env에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 채워주세요')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '', {
  auth: {
    persistSession: true,    // 세션을 localStorage에 자동 저장 (앱 재실행 후에도 로그인 유지)
    autoRefreshToken: true,  // 만료 전 토큰 자동 갱신
    detectSessionInUrl: false, // HashRouter와 충돌 방지
  },
  global: {
    // REST API(/rest/v1/) 요청에 apikey 헤더를 명시적으로 추가.
    // supabase-js가 내부적으로 세팅하지만, 버전/키 포맷에 따라
    // PostgREST 요청에서 누락되는 케이스를 방어.
    headers: {
      apikey: supabaseKey ?? '',
    },
  },
})
