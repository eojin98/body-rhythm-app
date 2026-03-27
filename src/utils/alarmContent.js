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

// 베타 테스트용 시간별 행동양식 (7시~23시)
export const TEST_HOURLY_BEHAVIORS = {
  '07': { id: 'test_07', title: '기상 후 물 한 잔 마시기', desc: '기상 직후 물을 마시면 신진대사가 활성화되고 수면 중 빠진 수분이 보충됩니다', tip: '미지근한 물 250ml를 천천히 마셔보세요' },
  '08': { id: 'test_08', title: '햇빛 10분 쬐기', desc: '아침 햇빛이 생체시계를 조절하고 세로토닌 분비를 촉진합니다', tip: '창가에 서거나 짧게 산책해 보세요' },
  '09': { id: 'test_09', title: '가벼운 스트레칭 5분', desc: '수면 중 굳어진 근육을 풀어 하루를 활기차게 시작해 보세요', tip: '목, 어깨, 허리 순서로 부드럽게 풀어주세요' },
  '10': { id: 'test_10', title: '집중 업무 시작 전 심호흡', desc: '깊은 호흡이 집중력과 뇌산소 공급을 높여줍니다', tip: '4초 들이쉬고 7초 참고 8초 내쉬기를 3회 반복하세요' },
  '11': { id: 'test_11', title: '자세 교정하기', desc: '장시간 앉아 있으면 허리와 목에 무리가 갑니다', tip: '모니터와 눈높이를 맞추고 등을 곧게 펴보세요' },
  '12': { id: 'test_12', title: '점심 식사 천천히 먹기', desc: '천천히 씹으면 소화가 잘 되고 과식을 방지할 수 있습니다', tip: '한 입에 20번 이상 씹는 것을 의식해 보세요' },
  '13': { id: 'test_13', title: '식후 10분 걷기', desc: '식후 가벼운 걷기가 혈당 조절과 소화에 도움이 됩니다', tip: '사무실 주변이나 계단을 이용해 보세요' },
  '14': { id: 'test_14', title: '눈 휴식 20-20-20 규칙', desc: '눈 피로를 줄여 시력을 보호하고 두통을 예방합니다', tip: '20분마다 20초간 6m 거리를 바라보세요' },
  '15': { id: 'test_15', title: '물 마시기', desc: '오후에 수분이 부족하면 집중력이 저하됩니다', tip: '물 한 컵(200ml)을 마시면 오후 피로가 줄어들어요' },
  '16': { id: 'test_16', title: '짧은 스트레칭', desc: '오후 스트레칭으로 혈액순환을 개선하고 피로를 해소하세요', tip: '손목, 목, 등을 차례로 3분간 풀어주세요' },
  '17': { id: 'test_17', title: '오늘 할 일 마무리 체크', desc: '하루 업무를 정리하면 내일의 스트레스가 줄어듭니다', tip: '완료한 일에 체크하고 미완료 항목은 내일로 이관하세요' },
  '18': { id: 'test_18', title: '저녁 식사 준비', desc: '규칙적인 저녁 식사 시간이 몸의 리듬을 안정시킵니다', tip: '취침 3시간 전에 저녁을 마치면 수면의 질이 높아져요' },
  '19': { id: 'test_19', title: '가벼운 운동 30분', desc: '저녁 가벼운 운동이 수면의 질과 스트레스 해소에 도움이 됩니다', tip: '걷기, 스트레칭, 요가 등 가볍게 시작해 보세요' },
  '20': { id: 'test_20', title: '내일 계획 세우기', desc: '하루를 마무리하며 내일 계획을 세우면 불안감이 줄어듭니다', tip: '핵심 할 일 3가지만 적어두세요' },
  '21': { id: 'test_21', title: '디지털 기기 사용 줄이기', desc: '블루라이트를 줄이면 멜라토닌 분비가 자연스럽게 증가합니다', tip: '취침 2시간 전부터 화면 밝기를 최소화하거나 야간 모드를 켜세요' },
  '22': { id: 'test_22', title: '수면 준비 루틴 시작', desc: '일관된 취침 루틴이 수면의 질을 높여줍니다', tip: '따뜻한 샤워, 가벼운 독서, 명상을 시도해 보세요' },
  '23': { id: 'test_23', title: '조명 어둡게, 취침 준비', desc: '어두운 환경이 멜라토닌 분비를 도와 자연스럽게 잠들게 합니다', tip: '간접 조명만 켜고 핸드폰을 멀리 두세요' },
}

// Returns custom behaviors if set, otherwise falls back to defaults
export function getEffectiveBehaviors(periodId, customBehaviors) {
  return customBehaviors?.[periodId] ?? ALARM_PERIODS[periodId]?.behaviors ?? []
}
