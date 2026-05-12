# Body Rhythm 알람 — CLAUDE.md

## 프로젝트 개요

일주기 리듬(Circadian Rhythm) 기반 습관 알람 앱. 사용자의 생체시계에 맞춰 하루 4개 고정 루틴(아침·오후·저녁·취침) 또는 시간별 17개 행동(테스트 모드)을 알람으로 알려준다. 알람 수신 시 알림창에서 **완료 / 나중에 / 건너뜀** 을 즉시 선택할 수 있고, 하루 실천률을 기록·시각화한다.

## 타겟 플랫폼

- **주력**: Android (Capacitor 네이티브 APK)
- **보조**: PWA (웹 브라우저 / iOS Safari 홈 화면 추가)
- iOS 네이티브(IPA) 빌드 설정은 현재 없음

## 기술 스택

### 앱 레이어
| 항목 | 내용 |
|------|------|
| UI 프레임워크 | React 18 + Vite 6 |
| 네이티브 브릿지 | **Capacitor 8** (`@capacitor/android`) |
| 알람/알림 | **`@capacitor/local-notifications` 8** (네이티브), Web Notification API (PWA 폴백) |
| UI 컴포넌트 | `@ionic/react` 8 |
| 라우팅 | `react-router-dom` v6 (HashRouter) |
| 차트 | `recharts` |
| PWA | `vite-plugin-pwa` (Workbox) |
| 언어 | JS(JSX) 메인, TypeScript 일부(`circadianGuide.ts`, `CircadianDetailPage.tsx`) |

### 커스텀 네이티브 플러그인
- **`DeviceRinger`** (`android/.../DeviceRingerPlugin.java`)
  - `getRingerMode()` → `{ mode: 0|1|2, isSilent: boolean }`
  - `ringerModeChanged` 이벤트 브로드캐스트 (AudioManager 리스너)
  - 무음(0)/진동(1) 모드일 때 알람 채널을 `alarm_silent`로 전환하는 데 사용

### 백엔드
- **없음.** Firebase 포함 외부 백엔드 서비스 미사용.
- 모든 데이터는 `localStorage` (기기 로컬 저장).

### 빌드 도구
- Vite (웹 번들)
- Gradle (Android APK)
- `npx cap sync` 로 웹 빌드를 Android 프로젝트에 동기화

## 배포 방식

### 현재 상태
**Capacitor Android APK** 로컬 빌드 전용. CI/CD 파이프라인 없음.

```
# 개발 서버
npm run dev

# 네이티브 APK 빌드 플로우
npm run cap:sync        # vite build → cap sync
npm run cap:open        # Android Studio에서 android/ 프로젝트 열기
# → Android Studio에서 Run / Build APK
```

Firebase Hosting, Vercel, Netlify 등 웹 배포 설정 **없음**.
(의도: 네이티브 알람 기능이 필요하므로 웹 배포는 기능 제한됨)

## 디렉토리 구조

```
Alarm/
├── src/
│   ├── App.jsx                  # 라우터 루트, 알림 채널 초기화, 알람 sync
│   ├── main.jsx
│   ├── pages/
│   │   ├── Home.jsx             # 메인 홈 (다음 알람, 오늘 실천률)
│   │   ├── Onboarding.jsx       # 최초 실행 온보딩
│   │   ├── MorningCheckin.jsx   # 아침 체크인 (식사, 수면 기록)
│   │   ├── Records.jsx          # 일/주/월 기록 뷰
│   │   ├── Dashboard.jsx        # 주간 실천률 대시보드
│   │   ├── Settings.jsx         # 알람 설정, 테스트 모드, 사운드 모드
│   │   ├── HealthRecords.jsx    # 건강 기록 상세
│   │   ├── CircadianDetailPage.tsx  # 시간대별 일주기 과학 상세
│   │   └── CircadianDetail.jsx
│   ├── components/
│   │   ├── BottomNav.jsx        # 하단 네비게이션
│   │   └── ProgressRing.jsx     # 실천률 원형 프로그레스
│   ├── utils/
│   │   ├── notifications.js     # 알림 채널 생성, 알람 스케줄/취소, 권한 요청
│   │   ├── storage.js           # localStorage CRUD, 설정/기록 관리
│   │   └── alarmContent.js      # 알람 콘텐츠 데이터 (ALARM_PERIODS, TEST_HOURLY_BEHAVIORS, TIME_PERIOD_GUIDES)
│   └── data/
│       └── circadianGuide.ts    # 일주기 리듬 과학 데이터 (06~23시, 18개 항목)
├── android/                     # Capacitor Android 프로젝트
│   └── app/src/main/
│       ├── java/com/bodyrhythm/alarm/
│       │   ├── MainActivity.java         # BridgeActivity, DeviceRingerPlugin 등록
│       │   └── DeviceRingerPlugin.java   # 커스텀 플러그인: 진동/무음 감지
│       └── AndroidManifest.xml
├── capacitor.config.json        # appId: com.bodyrhythm.alarm
├── vite.config.js               # Vite + PWA manifest
└── package.json
```

## 자주 쓰는 명령어

```bash
# 개발 서버 (PWA 모드로 브라우저 확인)
npm run dev

# 네이티브 빌드 전체 플로우
npm run cap:sync        # vite build + cap sync (웹 → Android 동기화)
npm run cap:open        # Android Studio 열기

# Android Studio 없이 CLI로 빌드 (gradle 필요)
cd android && ./gradlew assembleDebug
# 결과물: android/app/build/outputs/apk/debug/app-debug.apk
```

## 알람 구현 핵심 사항

### 알림 채널 (Android 8+)
3개 채널이 앱 초기화 시 생성됨 (`notifications.js: initNotificationChannels`):
- `alarm_sound` — 소리 + 진동 (importance 5)
- `alarm_vibrate` — 진동만 (importance 5)
- `alarm_silent` — 무음 (importance 3)

`DeviceRinger.getRingerMode()` 로 현재 단말 모드를 확인 후 채널 자동 선택.

### 알람 스케줄 방식
- **네이티브**: `LocalNotifications.schedule({ repeats: true, exact: true, on: { weekday, hour, minute } })` — 매주 반복
- **Notification ID 규칙**: `alarmId * 10 + dayIndex` (0~6 = 일~토, 8 = 스누즈 슬롯)
- **테스트 모드**: 매일 07~23시 정각 17개 알람 (ID: 9007~9023), 스누즈 ID: 9098
- **PWA 폴백**: 10초마다 폴링 → Web Notification API (백그라운드 실행 불가)

### 권한 (AndroidManifest.xml)
```xml
VIBRATE
WAKE_LOCK
RECEIVE_BOOT_COMPLETED   <!-- 재부팅 후 알람 복구용 권한 선언 (BroadcastReceiver 미구현) -->
SCHEDULE_EXACT_ALARM     <!-- Android 12+ 정확한 알람 -->
USE_EXACT_ALARM          <!-- Android 13+ 대안 권한 -->
POST_NOTIFICATIONS       <!-- Android 13+ 알림 권한 -->
```

### 알림창 액션 버튼
`HABIT_ACTION` 타입으로 등록: **✅ 완료 / 🔔 나중에 / ✖ 건너뜀**
- `done` → `saveRoutineAction(today, periodId, 'done')`
- `later` → `setSnooze` + 재스케줄 (루틴 30분, 테스트 모드 10분)
- `skip` → `saveRoutineAction(today, periodId, 'skipped')`

### 무음 모드 처리
`DeviceRinger` 플러그인이 `AudioManager.RINGER_MODE_CHANGED_ACTION` BroadcastReceiver를 등록.
모드 변경 시 `ringerModeChanged` 이벤트 → JS에서 `syncAllAlarmNotifications` 재호출 → 채널 재지정.

## 알려진 이슈 및 주의사항

### 재부팅 후 알람 복구 미구현
`RECEIVE_BOOT_COMPLETED` 권한은 선언했지만 `BootReceiver`(BroadcastReceiver 서브클래스)가 없어서 **기기 재부팅 시 예약된 알람이 사라진다.** Capacitor LocalNotifications 플러그인이 자체 처리하는지 확인 필요. 앱 재진입 시 `syncAllAlarmNotifications`로 복구되는 구조이긴 하지만, 재부팅 후 앱을 열기 전까지는 알람이 울리지 않음.

### 배터리 최적화 예외 요청 없음
삼성·샤오미 등 제조사 RAM 관리에 의해 백그라운드 프로세스 킬 가능. `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 권한 요청 미구현. 사용자에게 배터리 최적화 예외 안내 화면 추가 검토 필요.

### iOS 네이티브 빌드 미설정
`capacitor.config.json`에 `ios-pods-template`이 있지만 `ios/` 디렉토리가 없고, `npx cap add ios`가 실행된 적 없음. iOS 배포 시 별도 추가 필요.

### PWA는 기능 제한
웹/PWA 모드에서는 `isNative() === false` 분기로 폴백:
- 정확한 시간 알람 불가 (10초 폴링 기반)
- 백그라운드 실행 불가 (탭이 닫히면 알람 안 울림)
- 알림창 액션 버튼 없음

### 데이터 격리
`localStorage`를 `deviceId` prefix로 분리. 같은 브라우저에서 다른 deviceId면 데이터 공유 불가. `exportAllData` / `importAllData`로 수동 마이그레이션 가능.

## 앱 설정 구조 (storage.js)

```js
DEFAULT_SETTINGS = {
  onboardingComplete: false,
  wakeTime: '07:00',
  sleepTime: '23:00',
  alarms: [/* 4개 기본 알람 */],
  behaviors: {},          // 커스텀 행동 오버라이드
  testMode: false,        // true = 시간별 17개 알람
  alarmSoundMode: 'sound', // 'sound' | 'vibrate' | 'silent'
  notificationsEnabled: true,
  appVersion: '1.1.0',
}
```
