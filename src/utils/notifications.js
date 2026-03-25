import { wasNotifFired, markNotifFired } from './storage'

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export function getPermissionStatus() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function showNotification(title, body) {
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: title,
      renotify: true,
      requireInteraction: false,
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch (e) {
    console.warn('Notification failed:', e)
  }
}

export function checkAndFireAlarms(alarms) {
  if (!alarms || Notification.permission !== 'granted') return

  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`
  const currentDay = now.getDay()
  const minuteKey = `${now.toDateString()}_${currentTime}`

  alarms.forEach(alarm => {
    if (!alarm.enabled) return
    if (!alarm.days.includes(currentDay)) return
    if (alarm.time !== currentTime) return
    if (wasNotifFired(alarm.id, minuteKey)) return

    markNotifFired(alarm.id, minuteKey)
    showNotification(`${alarm.icon || '⏰'} ${alarm.name}`, `${formatTime12(alarm.time)} 알람입니다. 몸의 리듬을 지켜요!`)
  })
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${hour}:${String(m).padStart(2, '0')}`
}
