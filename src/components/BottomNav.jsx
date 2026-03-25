import { useLocation, useNavigate } from 'react-router-dom'

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.6 5.4 21 6 21H9M19 10L21 12M19 10V20C19 20.6 18.6 21 18 21H15M9 21V15C9 14.4 9.4 14 10 14H14C14.6 14 15 14.4 15 15V21M9 21H15"
        stroke={active ? '#6C5CE7' : '#A0A0B8'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RecordsIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="3" stroke={active ? '#6C5CE7' : '#A0A0B8'} strokeWidth="2"/>
      <path d="M16 2V6M8 2V6M3 10H21" stroke={active ? '#6C5CE7' : '#A0A0B8'} strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 14H8.01M12 14H12.01M16 14H16.01M8 18H8.01M12 18H12.01" stroke={active ? '#6C5CE7' : '#A0A0B8'} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function DashboardIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="13" width="4" height="8" rx="1" fill={active ? '#6C5CE7' : '#A0A0B8'}/>
      <rect x="10" y="9" width="4" height="12" rx="1" fill={active ? '#6C5CE7' : '#A0A0B8'}/>
      <rect x="17" y="5" width="4" height="16" rx="1" fill={active ? '#6C5CE7' : '#A0A0B8'}/>
    </svg>
  )
}

function SettingsIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={active ? '#6C5CE7' : '#A0A0B8'} strokeWidth="2"/>
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={active ? '#6C5CE7' : '#A0A0B8'}
        strokeWidth="2"
      />
    </svg>
  )
}

const navItems = [
  { path: '/', label: '홈', Icon: HomeIcon },
  { path: '/records', label: '기록', Icon: RecordsIcon },
  { path: '/dashboard', label: '통계', Icon: DashboardIcon },
  { path: '/settings', label: '설정', Icon: SettingsIcon },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav">
      {navItems.map(({ path, label, Icon }) => {
        const active = path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(path)
        return (
          <button
            key={path}
            className={`nav-item${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon active={active} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
