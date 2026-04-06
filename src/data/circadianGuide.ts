export type CircadianAction = {
  label: string;
  reason: string;
};

export type CircadianScience = {
  claim: string;
  evidence: string;
  strength: 'confirmed' | 'strong' | 'moderate' | 'conditional';
};

export type CircadianHour = {
  hour: number;
  phase: 'wake' | 'peak' | 'social' | 'dip' | 'peak2' | 'wind';
  phaseName: string;
  stateName: string;
  energyLevel: string;
  hormones: string[];
  actions: CircadianAction[];
  warnings: CircadianAction[];
  science: CircadianScience[];
};

export const PHASE_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  wake:   { bg: '#FAEEDA', text: '#633806', accent: '#EF9F27' },
  peak:   { bg: '#E6F1FB', text: '#0C447C', accent: '#378ADD' },
  social: { bg: '#E1F5EE', text: '#085041', accent: '#1D9E75' },
  dip:    { bg: '#FBEAF0', text: '#72243E', accent: '#D4537E' },
  peak2:  { bg: '#EEEDFE', text: '#3C3489', accent: '#534AB7' },
  wind:   { bg: '#F1EFE8', text: '#2C2C2A', accent: '#444441' },
};

export const CIRCADIAN_DATA: CircadianHour[] = [
  {
    hour: 6, phase: 'wake', phaseName: '각성 준비', stateName: '각성 개시', energyLevel: '낮음',
    hormones: ['코르티솔 급상승', '멜라토닌 소멸', '체온 상승 시작'],
    actions: [
      { label: '햇빛 10분 노출', reason: 'ipRGC 세포가 청색광 감지 → SCN 생체시계 동기화' },
      { label: '공복 물 400–500ml', reason: '수면 중 손실 수분 보충, 간 해독 대사 활성화' },
    ],
    warnings: [
      { label: '즉시 커피·카페인', reason: '코르티솔 피크와 겹치면 내성만 증가, 실질 효과 감소' },
    ],
    science: [
      { claim: '기상 후 30–45분이 코르티솔 각성 반응(CAR) 피크', strength: 'confirmed',
        evidence: 'CAR(Cortisol Awakening Response)는 기상 직후 코르티솔이 50–160% 급등하는 현상. HPA축이 면역 활성화·혈당 조절·인지 준비를 위해 하루를 여는 생리적 신호입니다.' },
    ],
  },
  {
    hour: 7, phase: 'wake', phaseName: '각성 준비', stateName: '코르티솔 피크', energyLevel: '중간',
    hormones: ['코르티솔 최고점', '면역 활성화', '혈압 정상화'],
    actions: [
      { label: '10–15분 야외 걷기', reason: '햇빛+움직임으로 체온 상승 가속, 도파민 합성 촉진' },
      { label: '단백질 중심 아침식사', reason: '티로신 공급 → 도파민·노르에피네프린 전구체 확보' },
    ],
    warnings: [
      { label: '카페인 섭취', reason: '코르티솔 최고점 시 각성 추가 효과 없이 내성만 형성' },
    ],
    science: [
      { claim: '아침 햇빛이 일주기 리듬을 24시간 재설정', strength: 'strong',
        evidence: '망막 ipRGC 세포의 480nm 청색광 감지가 시신경교차위핵(SCN)에 직접 신호를 보내 멜라토닌 억제와 코르티솔 분비를 조율합니다. Roenneberg et al. (2012).' },
    ],
  },
  {
    hour: 8, phase: 'peak', phaseName: '인지 피크', stateName: '인지 상승기', energyLevel: '높음',
    hormones: ['도파민 상승', '코르티솔 안정화', '집중력 상승'],
    actions: [
      { label: '가장 어려운 작업 시작', reason: '인지 자원이 아직 소모되지 않은 상태 — 중요한 일 먼저' },
      { label: '카페인 최적 타이밍', reason: '코르티솔 하강 구간 진입 → 아데노신 길항 효과 극대화' },
    ],
    warnings: [
      { label: '이메일·SNS부터 확인', reason: '도파민 보상 루프가 고집중 자원을 소모시킴' },
    ],
    science: [
      { claim: '카페인은 코르티솔 하강 시 효과가 최대', strength: 'moderate',
        evidence: '코르티솔 높을 때 아데노신 수용체가 이미 부분 차단 상태 → 카페인 추가 효과 감소 + 내성 가속. 09:30 이후 섭취 시 아데노신 수용체 길항 효과가 실질적으로 작동합니다. Lovallo et al. (2006).' },
    ],
  },
  {
    hour: 9, phase: 'peak', phaseName: '인지 피크', stateName: '인지 피크 진입', energyLevel: '최고',
    hormones: ['전두엽 최고 활성', '의사결정 최적', '작업기억 피크'],
    actions: [
      { label: '전략 기획·심층 분석', reason: '억제 조절과 인지 유연성이 하루 최고 — 복잡한 문제에 투자' },
      { label: '딥워크 블록 설정', reason: '알림 차단, 단일 작업 집중 — 인지 피크 보호' },
    ],
    warnings: [
      { label: '회의·행정 업무 집중 배치', reason: '고가치 인지 자원을 저가치 업무에 낭비하는 것' },
    ],
    science: [
      { claim: '전두엽 실행 기능은 오전 9–11시 최고조', strength: 'strong',
        evidence: 'Anderson et al. (2014): 인지 유연성·억제 조절·작업기억이 오전 10시경 24시간 최고치. 코어 체온 상승 및 카테콜아민 농도와 강한 상관관계.' },
    ],
  },
  {
    hour: 10, phase: 'peak', phaseName: '인지 피크', stateName: '집중력 정점', energyLevel: '최고',
    hormones: ['각성도 최고', '학습 효율 최대', '창의 사고 활성'],
    actions: [
      { label: '창의적 문제 해결', reason: '확산적 사고와 수렴적 사고가 균형 — 브레인스토밍 최적' },
      { label: '새로운 개념 학습', reason: '해마 기반 장기기억 인코딩 효율이 하루 중 최고' },
    ],
    warnings: [
      { label: '단순 반복 업무만 처리', reason: '인지 피크를 낮은 인지 부하 작업에 낭비' },
    ],
    science: [
      { claim: '해마 장기강화(LTP) 효율은 오전이 높다', strength: 'moderate',
        evidence: '글루코코르티코이드(코르티솔)의 적정 수준이 해마 시냅스 가소성을 촉진합니다. 오전의 적정 농도에서 새 정보 인코딩이 효율적입니다.' },
    ],
  },
  {
    hour: 11, phase: 'peak', phaseName: '인지 피크', stateName: '피크 후반', energyLevel: '높음',
    hormones: ['집중력 유지', '전환 준비', '마무리 최적'],
    actions: [
      { label: '오전 작업 마무리·정리', reason: '진행 중인 딥워크를 완결 짓는 것이 전환 비용 최소화' },
      { label: '중요한 1:1 소통·피드백', reason: '언어 처리 능력 아직 높음 — 중요한 대화 배치' },
    ],
    warnings: [
      { label: '새 복잡한 프로젝트 시작', reason: '오후 진입 전 미완성 작업은 인지 부하 증가 유발' },
    ],
    science: [
      { claim: '인지 과제 전환 비용은 오후로 갈수록 증가', strength: 'moderate',
        evidence: '작업 전환(task switching) 시 소요되는 인지 비용은 피로 누적에 따라 증가합니다. 오전 후반에 작업을 완결짓는 것이 오후 생산성 보전에 유리합니다.' },
    ],
  },
  {
    hour: 12, phase: 'social', phaseName: '활성·사교', stateName: '사회적 각성', energyLevel: '높음',
    hormones: ['세로토닌 지속', '옥시토신 활성', '언어 처리 활성'],
    actions: [
      { label: '팀 미팅·협업', reason: '사회적 인지와 언어 유창성이 높은 시간대' },
      { label: '점심 — 복합탄수+단백질', reason: '트립토판 흡수 최적화로 오후 세로토닌 유지' },
    ],
    warnings: [
      { label: '단당류 과다 점심', reason: '혈당 스파이크→크래시가 오후 집중력 급락 유발' },
    ],
    science: [
      { claim: '탄수화물이 트립토판 뇌 흡수를 높인다', strength: 'confirmed',
        evidence: '인슐린이 BCAA만 근육으로 유도 → 트립토판의 혈뇌장벽 통과 경쟁 감소 → 세로토닌 합성 증가. Fernstrom & Wurtman (1971) 이후 반복 검증.' },
    ],
  },
  {
    hour: 13, phase: 'social', phaseName: '활성·사교', stateName: '식후 전환', energyLevel: '중간',
    hormones: ['소화 활성', '혈당 관리 중요', '걷기 최적'],
    actions: [
      { label: '식후 10분 가벼운 걷기', reason: '혈당 스파이크 20–30% 감소, 소화 촉진, 인슐린 감수성 개선' },
      { label: '루틴·행정 업무', reason: '높은 인지 부하 불필요한 작업 처리에 최적' },
    ],
    warnings: [
      { label: '바로 눕거나 앉아서 쉬기', reason: '위식도역류 위험 증가 + 혈당 조절 악화' },
    ],
    science: [
      { claim: '식후 10분 걷기가 혈당을 효과적으로 낮춤', strength: 'strong',
        evidence: 'Buffey et al. (2022) Sports Medicine: 식후 2–5분 가벼운 걷기도 혈당 반응을 유의하게 개선. 식후 즉시 서 있거나 걷는 것이 앉아 있는 것 대비 혈당 피크를 낮춥니다.' },
    ],
  },
  {
    hour: 14, phase: 'dip', phaseName: '오후 딥', stateName: '포스트런치 딥', energyLevel: '낮음',
    hormones: ['멜라토닌 소폭↑', '졸음 욕구', '일주기 딥'],
    actions: [
      { label: '파워냅 10–20분', reason: 'Stage 1–2 수면 → 각성 시 수면관성 없음, 인지 34% 회복' },
      { label: '호흡 명상 5–10분', reason: '부교감 신경 활성화로 오후 회복 촉진' },
    ],
    warnings: [
      { label: '30분 이상 낮잠', reason: '서파수면 진입 후 각성 → 수면관성으로 30분간 인지 저하' },
      { label: '중요한 의사결정', reason: '인지 피로 누적으로 결정 품질 저하' },
    ],
    science: [
      { claim: '오후 딥은 음식이 아닌 일주기 리듬', strength: 'confirmed',
        evidence: 'Zulley et al. (1989): 공복 상태에서도 오후 1–3시 졸음이 나타남. 일주기 리듬의 이중 진동 패턴(bimodal)에 의한 것. NASA 파워냅 연구(Rosekind, 1995): 26분 낮잠이 수행 능력 34%, 각성도 100% 향상.' },
    ],
  },
  {
    hour: 15, phase: 'dip', phaseName: '오후 딥', stateName: '회복 구간', energyLevel: '낮음→중간',
    hormones: ['코르티솔 하강', '집중 난이도↑', '단순업무 적합'],
    actions: [
      { label: '이메일·메시지 처리', reason: '낮은 인지 부하 작업 — 피크 시간을 소모하지 않아도 되는 업무' },
      { label: '음악과 함께 단순 작업', reason: '도파민 자극으로 루틴 업무 모노토니 극복' },
    ],
    warnings: [
      { label: '중요 의사결정', reason: '인지 피로 누적으로 결정 품질 저하 (결정 피로 효과)' },
    ],
    science: [
      { claim: '결정 피로는 오후에 축적된다', strength: 'strong',
        evidence: 'Danziger et al. (2011): 판사들의 가석방 승인율이 오전 65%에서 오후 세션 초반 급락. 인지 자원 고갈이 보수적·현상 유지 결정을 유도합니다.' },
    ],
  },
  {
    hour: 16, phase: 'peak2', phaseName: '신체 피크', stateName: '신체 준비', energyLevel: '중간→높음',
    hormones: ['체온 재상승', '근력 회복', '반응속도↑'],
    actions: [
      { label: '근력 훈련 시작', reason: '체온·근육 산소 공급·테스토스테론이 상승 중 — 부상 위험 낮음' },
      { label: '마지막 카페인 허용', reason: '반감기 5–7시간 고려 시 16시가 취침 전 카페인 마지노선' },
    ],
    warnings: [
      { label: '16시 이후 카페인', reason: '취침 자정 기준 → 16시 카페인의 25%가 수면 시 잔류' },
    ],
    science: [
      { claim: '근력·유산소 퍼포먼스는 오후 후반 최고', strength: 'strong',
        evidence: 'Atkinson & Reilly (1996): 폐활량·근력·무산소 역치 모두 체온 최고점인 오후 5–7시에 최대치. 이 시간대 운동이 부상 위험도 가장 낮습니다.' },
    ],
  },
  {
    hour: 17, phase: 'peak2', phaseName: '신체 피크', stateName: '신체 피크', energyLevel: '최고',
    hormones: ['체온 2차 최고', '근력 최대', '반응속도 최고'],
    actions: [
      { label: '고강도 인터벌·근력 훈련', reason: '모든 운동 지표가 최고 — 근비대, 지구력 향상 효율 최대' },
      { label: '유산소·스포츠 활동', reason: '산소 운반 능력과 근육 효율 모두 최고치' },
    ],
    warnings: [
      { label: '완전 무활동으로 보내기', reason: '신체 피크를 활용하지 않으면 수면 압력 축적이 느려질 수 있음' },
    ],
    science: [
      { claim: '체온과 운동 퍼포먼스는 강한 상관관계', strength: 'confirmed',
        evidence: 'Drust et al. (2005): 코어 체온 1°C 상승 시 근육 효소 활성 2배, 신경 전도 속도 증가. 오후 5–7시 체온 피크가 퍼포먼스 피크와 일치합니다.' },
    ],
  },
  {
    hour: 18, phase: 'peak2', phaseName: '신체 피크', stateName: '창의적 발산', energyLevel: '높음',
    hormones: ['억제 완화', '연상 사고↑', '사교 최적'],
    actions: [
      { label: '창의 작업·취미 활동', reason: '전전두엽 억제 완화 → 예상치 못한 연결과 아이디어 생성' },
      { label: '저녁 산책·일몰 감상', reason: '따뜻한 일몰 빛이 멜라토닌 분비 시작을 부드럽게 신호' },
    ],
    warnings: [
      { label: '격렬한 운동 (19시 이후)', reason: '코어 체온 상승이 수면 개시를 2–3시간 지연' },
    ],
    science: [
      { claim: '창의적 사고는 오후 후반 발산적 사고가 활발', strength: 'moderate',
        evidence: 'Wieth & Zacks (2011): 비선형적 창의 문제 해결은 오히려 최적이 아닌 시간대(오후)에 더 잘 될 수 있음. 억제 감소가 연상 폭을 넓힙니다.' },
    ],
  },
  {
    hour: 19, phase: 'peak2', phaseName: '신체 피크', stateName: '하강 전환', energyLevel: '중간',
    hormones: ['코르티솔 하강', '회복 모드 전환', '인슐린 감수성↓'],
    actions: [
      { label: '가벼운 저녁 소식', reason: '인슐린 감수성 저하 시간대 — 소식이 수면 질과 체중 관리에 유리' },
      { label: '가족·사교 시간', reason: '옥시토신 분비 → 스트레스 완충, 수면 전 정서 안정' },
    ],
    warnings: [
      { label: '대용량 고지방 저녁', reason: '소화 부담 + 인슐린 저항성 시간대 → 지방 축적 및 수면 질 저하' },
    ],
    science: [
      { claim: '저녁 인슐린 감수성은 아침보다 낮다', strength: 'strong',
        evidence: '일주기 리듬에 따라 인슐린 감수성이 오전이 가장 높고 저녁으로 갈수록 감소합니다. 같은 식사도 저녁에 먹으면 혈당 반응이 더 크게 나타납니다. Sutton et al. (2018) Cell Metabolism.' },
    ],
  },
  {
    hour: 20, phase: 'wind', phaseName: '하강·수면 준비', stateName: '조명 어둡게', energyLevel: '낮음',
    hormones: ['멜라토닌 개시', '청색광 민감', '조명 관리 시작'],
    actions: [
      { label: '조명 2700K 이하로 전환', reason: '따뜻한 전구색·간접조명으로 멜라토닌 분비 보호' },
      { label: '독서·저자극 활동', reason: '교감 신경 하강 유도, 뇌를 수면 모드로 전환' },
    ],
    warnings: [
      { label: '밝은 스크린 직접 응시', reason: '480nm 청색광이 멜라토닌 억제 → 수면 개시 1–2시간 지연' },
    ],
    science: [
      { claim: '청색광은 멜라토닌을 최대 85% 억제', strength: 'confirmed',
        evidence: 'Brainard et al. (2001), Lockley et al. (2003): 460–480nm 청색광이 동일 밝기 녹색광 대비 멜라토닌을 현저히 더 억제. 스마트폰·LED가 주요 원인입니다.' },
    ],
  },
  {
    hour: 21, phase: 'wind', phaseName: '하강·수면 준비', stateName: '코어 체온 하강', energyLevel: '낮음',
    hormones: ['멜라토닌↑↑', '심부체온 하강', '수면 압력↑'],
    actions: [
      { label: '40–42°C 온수 목욕 10분', reason: '체표 혈관 확장 → 코어 열 방산 → 심부 체온 가속 하강' },
      { label: '침실 온도 18–20°C 유지', reason: '코어 체온 하강을 돕는 환경 → 수면 개시 촉진' },
    ],
    warnings: [
      { label: '강한 운동', reason: '체온 상승이 수면 개시를 방해' },
    ],
    science: [
      { claim: '취침 전 온수 목욕이 수면 개시 단축', strength: 'strong',
        evidence: 'Haghayegh et al. (2019) Sleep Medicine Reviews: 취침 1–2시간 전 40–42°C 온수 목욕이 수면 개시 평균 10분 단축. 체표 혈관 확장 후 급냉이 심부 체온 하강을 가속합니다.' },
    ],
  },
  {
    hour: 22, phase: 'wind', phaseName: '하강·수면 준비', stateName: '수면 준비', energyLevel: '최저',
    hormones: ['멜라토닌 최고', '성장호르몬 준비', '세포 수리 준비'],
    actions: [
      { label: '모든 스크린 종료', reason: '멜라토닌 보호 + 뇌의 디폴트 모드 네트워크 정리 허용' },
      { label: '내일 할 일 3가지 적기', reason: '미완성 과제의 제이가르닉 효과 해제 → 반추 감소' },
    ],
    warnings: [
      { label: '뉴스·자극적 콘텐츠', reason: '코르티솔 재활성화로 멜라토닌 억제 + 수면 개시 방해' },
    ],
    science: [
      { claim: '취침 전 할 일 목록 작성이 수면 개시 단축', strength: 'moderate',
        evidence: 'Scullin et al. (2018): 취침 5분 전 다음 날 할 일을 구체적으로 쓴 그룹이 수면 개시가 9분 빨랐습니다. 제이가르닉 효과(미완 과제 반추) 해소 기전.' },
    ],
  },
  {
    hour: 23, phase: 'wind', phaseName: '하강·수면 준비', stateName: '수면 골든 타임', energyLevel: '최저',
    hormones: ['성장호르몬 분비', '기억 공고화 시작', '세포 수리 활성'],
    actions: [
      { label: '취침 (완전 암흑 환경)', reason: '0lux 완전 암흑이 REM/NREM 사이클 질을 높임' },
      { label: '4–7–8 복식 호흡', reason: '부교감 신경 활성화로 심박수 하강, 입면 가속' },
    ],
    warnings: [
      { label: '자정 이후 취침 습관화', reason: '성장호르몬 분비 피크(23–01시)를 놓치고 회복 품질 저하' },
    ],
    science: [
      { claim: '성장호르몬의 70%는 수면 첫 사이클에 분비', strength: 'confirmed',
        evidence: 'Van Cauter et al. (2000): 성장호르몬 분비의 대부분이 수면 시작 후 첫 서파수면(SWS) 구간에 집중됩니다. 늦은 취침은 이 분비 피크를 이동시켜 회복·근합성·대사 회복이 감소합니다.' },
    ],
  },
];

export function getCurrentHourData(): CircadianHour {
  const hour = new Date().getHours();
  const clamped = Math.min(Math.max(hour, 6), 23);
  return CIRCADIAN_DATA.find(d => d.hour === clamped) ?? CIRCADIAN_DATA[0];
}
