// 앱 밖(메일 앱·기본 브라우저)으로 링크를 연다. 앱 WebView 안에서는 절대 열지 않는다.
import { Capacitor } from '@capacitor/core'
import { AppLauncher } from '@capacitor/app-launcher'

/**
 * @param {string} url  https://… 또는 mailto:…
 * @returns {Promise<boolean>} 열 앱을 찾았으면 true (앱: ACTION_VIEW 인텐트를 처리할 앱이 없으면 false)
 */
export async function openExternal(url) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { completed } = await AppLauncher.openUrl({ url })
      return completed
    } catch (e) {
      console.warn('[externalLink] openUrl error:', e)
      return false
    }
  }
  if (url.startsWith('mailto:')) window.location.href = url
  else window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
