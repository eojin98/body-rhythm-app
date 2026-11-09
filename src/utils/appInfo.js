// 화면 표시용 앱 버전. 설정 마이그레이션 키인 storage.APP_VERSION과는 별개다.
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { version as WEB_VERSION } from '../../package.json'

export { WEB_VERSION }

/** 앱: versionName (versionCode). 웹이거나 조회 실패 시: package.json 버전 */
export async function getDisplayVersion() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { version, build } = await App.getInfo()
      return `${version} (${build})`
    } catch {}
  }
  return WEB_VERSION
}
