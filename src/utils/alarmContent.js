export const ALARM_PERIODS = {
  morning: {
    id: 'morning',
    name: '아침 루틴',
    icon: '🌅',
    gradient: 'linear-gradient(135deg, #F6D365 0%, #FDA085 100%)',
    color: '#E67E22',
    darkText: true,
    defaultTime: '07:30',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    behaviors: [
      {
        id: 'sunlight',
        title: '햇빛 보기',
        desc: '아침 햇빛이 생체시계를 조절하고 기분을 높여줍니다',
        tip: '커튼을 열거나 베란다에 잠깐 나가보세요',
      },
      {
        id: 'water',
        title: '물 마시기',
        desc: '기상 후 물 한 잔으로 신진대사를 깨워보세요',
        tip: '미지근한 물 250ml를 천천히 마셔보세요',
      },
      {
        id: 'stretch',
        title: '스트레칭',
        desc: '5분 스트레칭으로 몸을 깨우고 혈액순환을 돕습니다',
        tip: '목·어깨·허리 순서로 부드럽게 풀어주세요',
      },
    ],
  },
  afternoon: {
    id: 'afternoon',
    name: '오후 루틴',
    icon: '☀️',
    gradient: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
    color: '#00B894',
    darkText: true,
    defaultTime: '13:30',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    behaviors: [
      {
        id: 'walk',
        title: '짧은 산책',
        desc: '점심 후 10분 산책은 소화와 오후 집중력에 도움이 됩니다',
        tip: '사무실 주변이나 계단을 이용해보세요',
      },
      {
        id: 'stretch',
        title: '스트레칭',
        desc: '앉아 있어 굳어진 몸을 잠깐 풀어주세요',
        tip: '손목·목·등을 가볍게 풀어주세요',
      },
      {
        id: 'eye_rest',
        title: '눈 휴식',
        desc: '20-20-20 규칙으로 눈 피로를 줄여보세요',
        tip: '20분마다 20초간 6m 앞을 바라보세요',
      },
    ],
  },
  evening: {
    id: 'evening',
    name: '저녁 루틴',
    icon: '🌆',
    gradient: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
    color: '#6C5CE7',
    defaultTime: '18:30',
    defaultDays: [1, 2, 3, 4, 5],
    behaviors: [
      {
        id: 'exercise',
        title: '운동하기',
        desc: '저녁 가벼운 운동이 수면의 질을 높여줍니다',
        tip: '30분 걷기나 가벼운 스트레칭으로 시작해보세요',
      },
      {
        id: 'dinner',
        title: '저녁 식사',
        desc: '규칙적인 저녁 식사 시간이 몸의 리듬을 잡아줍니다',
        tip: '취침 3시간 전에 식사를 마치면 좋아요',
      },
      {
        id: 'digest',
        title: '소화 돕기',
        desc: '식후 가벼운 활동이 소화를 도와줍니다',
        tip: '짧은 산책이나 가벼운 집안일을 해보세요',
      },
    ],
  },
  bedtime: {
    id: 'bedtime',
    name: '취침 준비',
    icon: '🌙',
    gradient: 'linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)',
    color: '#2C3E50',
    defaultTime: '22:30',
    defaultDays: [0, 1, 2, 3, 4, 5, 6],
    behaviors: [
      {
        id: 'dim_lights',
        title: '조명 줄이기',
        desc: '취침 1시간 전 조명을 줄이면 멜라토닌 분비를 돕습니다',
        tip: '스탠드나 간접 조명으로 전환해보세요',
      },
      {
        id: 'no_phone',
        title: '핸드폰 끄기',
        desc: '블루라이트 차단이 숙면에 도움이 됩니다',
        tip: '취침 30분 전 핸드폰을 내려놓고 책을 읽어보세요',
      },
      {
        id: 'sleep_prep',
        title: '수면 준비',
        desc: '몸과 마음을 이완시켜 좋은 잠을 준비하세요',
        tip: '따뜻한 샤워나 가벼운 스트레칭을 해보세요',
      },
    ],
  },
}

export const PERIOD_ORDER = ['morning', 'afternoon', 'evening', 'bedtime']

// Returns custom behaviors if set, otherwise falls back to defaults
export function getEffectiveBehaviors(periodId, customBehaviors) {
  return customBehaviors?.[periodId] ?? ALARM_PERIODS[periodId]?.behaviors ?? []
}
