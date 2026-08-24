export type VerificationStatus =
  | "machine_detected"
  | "review_required"
  | "partially_verified"
  | "verified";

export type PolicyStatus = "open" | "upcoming" | "rolling" | "closed" | "unknown";

export type PolicyCategory =
  | "일자리"
  | "주거"
  | "교육"
  | "금융"
  | "복지·문화"
  | "창업"
  | "참여·기반";

export interface SourceRecord {
  id: string;
  name: string;
  organization: string;
  url: string;
  kind: "policy_portal" | "official_notice" | "statistics" | "law";
  fetchedAt: string;
  sourceUpdatedAt?: string;
  license: string;
}

export interface PolicyRecord {
  id: string;
  slug: string;
  officialName: string;
  aliases: string[];
  summary: string;
  purpose: string;
  category: PolicyCategory;
  scope: "national" | "regional";
  region: string;
  regionCode: string;
  leadOrganization: string;
  status: PolicyStatus;
  verificationStatus: VerificationStatus;
  firstObservedAt: string;
  lastObservedAt: string;
  lastReviewedAt?: string;
  age: string;
  eligibility: string[];
  benefit: string;
  applicationPeriod: string;
  applicationChannel: string;
  requiredDocuments: string[];
  budget: string;
  legalBasis: string;
  sourceId: string;
  relatedPolicyIds: string[];
  lifeSituations: string[];
  programId: string;
  roundId: string;
}

export interface ChangeEvent {
  id: string;
  policyId: string;
  type:
    | "신규"
    | "모집 시작"
    | "마감 임박"
    | "자격 변경"
    | "지원 변경"
    | "문서 변경"
    | "통계 갱신";
  field: string;
  previousValue: string;
  currentValue: string;
  detectedAt: string;
  announcedAt?: string;
  effectiveAt?: string;
  impact: "critical" | "high" | "medium" | "low" | "informational";
  verificationStatus: VerificationStatus;
  summary: string;
  sourceId: string;
}

export interface IndicatorRecord {
  id: string;
  name: string;
  category: string;
  unit: string;
  organization: string;
  tableName: string;
  frequency: string;
  status: "connected" | "snapshot" | "key_required";
  basisDate: string;
  sourceId: string;
  limitations: string;
}

export const snapshot = {
  datasetVersion: "2026.08.24-mvp.1",
  generatedAt: "2026-08-24T15:30:00+09:00",
  basisDate: "2026-08-24",
  nextCollectionAt: "API 키 등록 후 원천별 갱신주기에 따라 실행",
  notice:
    "현재 MVP는 공식 출처 연결과 검증 흐름을 확인하기 위한 개발 스냅샷입니다. 변동 가능한 신청조건은 반드시 공식 원문에서 최종 확인하세요.",
};

export const sources: SourceRecord[] = [
  {
    id: "src-youthcenter",
    name: "온통청년 청년정책 통합검색",
    organization: "국무조정실 청년정책조정실·한국고용정보원",
    url: "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch",
    kind: "policy_portal",
    fetchedAt: snapshot.generatedAt,
    license: "공공누리·개별 원천 조건 확인",
  },
  {
    id: "src-youth-api",
    name: "온통청년 Open API 제공목록",
    organization: "한국고용정보원",
    url: "https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc",
    kind: "policy_portal",
    fetchedAt: snapshot.generatedAt,
    license: "이용승인 후 인증키 필요",
  },
  {
    id: "src-kosis",
    name: "KOSIS 공유서비스",
    organization: "국가데이터처",
    url: "https://kosis.kr/openapi/",
    kind: "statistics",
    fetchedAt: snapshot.generatedAt,
    license: "KOSIS 공유서비스 이용약관",
  },
  {
    id: "src-law",
    name: "국가법령정보 공동활용 Open API",
    organization: "법제처",
    url: "https://open.law.go.kr/LSO/openApi/guideList.do",
    kind: "law",
    fetchedAt: snapshot.generatedAt,
    license: "국가법령정보 공동활용 조건",
  },
  {
    id: "src-daejeon",
    name: "대전청년포털",
    organization: "대전광역시·대전청년내일재단",
    url: "https://www.daejeonyouthportal.kr/",
    kind: "policy_portal",
    fetchedAt: snapshot.generatedAt,
    license: "공식 페이지 인용·원문 연결",
  },
  {
    id: "src-daejeon-housing",
    name: "2026 청년·청년부부 주택임차보증금 이자지원",
    organization: "대전광역시·대전청년내일재단",
    url: "https://www.daejeonyouthportal.kr/content/CT_000000000059/cntPage.do?commonMenuNo=79_80&dpmSectionFst=2&dpmSectionScd=9",
    kind: "official_notice",
    fetchedAt: snapshot.generatedAt,
    sourceUpdatedAt: "2026-02-19",
    license: "공식 페이지 인용·원문 연결",
  },
  {
    id: "src-daejeon-account",
    name: "미래두배 청년통장",
    organization: "대전광역시·대전청년내일재단",
    url: "https://www.daejeonyouthportal.kr/content/CT_000000000067/cntPage.do?commonMenuNo=36_281",
    kind: "official_notice",
    fetchedAt: snapshot.generatedAt,
    sourceUpdatedAt: "2025-10-02",
    license: "공식 페이지 인용·원문 연결",
  },
  {
    id: "src-daejeon-hope",
    name: "청년내일희망카드",
    organization: "대전광역시·대전청년내일재단",
    url: "https://www.daejeonyouthportal.kr/content/CT_000000000163/cntPage.do?commonMenuNo=36_49_50",
    kind: "official_notice",
    fetchedAt: snapshot.generatedAt,
    license: "공식 페이지 인용·원문 연결",
  },
  {
    id: "src-daejeon-startup",
    name: "대전 청년 창업지원카드",
    organization: "대전광역시·대전청년내일재단",
    url: "https://www.daejeonyouthportal.kr/content/CT_000000000050/cntPage.do?commonMenuNo=36_63&dpmSectionFst=1&dpmSectionScd=6",
    kind: "official_notice",
    fetchedAt: snapshot.generatedAt,
    license: "공식 페이지 인용·원문 연결",
  },
];

type PolicySeed = Omit<
  PolicyRecord,
  | "id"
  | "programId"
  | "roundId"
  | "aliases"
  | "purpose"
  | "firstObservedAt"
  | "lastObservedAt"
  | "requiredDocuments"
  | "budget"
  | "legalBasis"
  | "relatedPolicyIds"
> & {
  purpose?: string;
  legalBasis?: string;
  related?: number[];
};

const policySeeds: PolicySeed[] = [
  { slug: "national-employment-support", officialName: "국민취업지원제도", summary: "취업지원서비스와 생계지원을 결합한 고용안전망", category: "일자리", scope: "national", region: "전국", regionCode: "00", leadOrganization: "고용노동부", status: "rolling", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "청년특례 등 유형별 상이", eligibility: ["취업을 원하는 사람", "소득·재산·취업경험 기준은 유형별 확인"], benefit: "상담·직업훈련·일경험·취업알선 및 유형별 수당", applicationPeriod: "상시", applicationChannel: "고용24 또는 고용센터", sourceId: "src-youthcenter", lifeSituations: ["취업을 준비하고 있어요"], purpose: "취업취약계층의 노동시장 진입 지원" },
  { slug: "youth-leap-account", officialName: "청년도약계좌", summary: "청년의 중장기 자산형성을 지원하는 정책금융 상품", category: "금융", scope: "national", region: "전국", regionCode: "00", leadOrganization: "금융위원회", status: "rolling", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공고·가입일 기준 확인", eligibility: ["개인소득·가구소득 요건", "금융소득종합과세 여부 확인"], benefit: "본인 납입금에 정부기여금과 비과세 혜택 결합", applicationPeriod: "금융기관 일정에 따름", applicationChannel: "취급은행 앱", sourceId: "src-youthcenter", lifeSituations: ["자산을 만들고 싶어요"] },
  { slug: "youth-tomorrow-savings", officialName: "청년내일저축계좌", summary: "근로 청년의 저축에 정부지원금을 매칭하는 자산형성 사업", category: "금융", scope: "national", region: "전국", regionCode: "00", leadOrganization: "보건복지부", status: "closed", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "모집공고 기준 확인", eligibility: ["근로·사업소득 발생", "가구소득·재산 기준"], benefit: "본인 저축액에 소득구간별 정부지원금 매칭", applicationPeriod: "연도별 모집", applicationChannel: "복지로 또는 읍면동 행정복지센터", sourceId: "src-youthcenter", lifeSituations: ["자산을 만들고 싶어요"] },
  { slug: "youth-monthly-rent", officialName: "청년월세 특별지원", summary: "주거비 부담이 큰 무주택 청년에게 월세를 지원", category: "주거", scope: "national", region: "전국", regionCode: "00", leadOrganization: "국토교통부", status: "unknown", verificationStatus: "review_required", age: "사업 차수별 공고 확인", eligibility: ["부모와 별도 거주", "무주택", "소득·재산 기준"], benefit: "실제 납부 월세 범위에서 월별 지원", applicationPeriod: "차수별 공고", applicationChannel: "복지로 또는 주소지 행정복지센터", sourceId: "src-youthcenter", lifeSituations: ["월세가 부담돼요"], legalBasis: "주거기본법 등 관련 지침" },
  { slug: "youth-housing-dream-account", officialName: "청년주택드림청약통장", summary: "청년의 주택 마련을 위한 청약·저축 연계 상품", category: "주거", scope: "national", region: "전국", regionCode: "00", leadOrganization: "국토교통부", status: "rolling", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "가입일 기준 확인", eligibility: ["무주택 청년", "소득기준 확인"], benefit: "우대이율·비과세·소득공제 및 대출 연계", applicationPeriod: "상시", applicationChannel: "주택도시기금 취급은행", sourceId: "src-youthcenter", lifeSituations: ["내 집 마련을 준비해요"] },
  { slug: "k-digital-training", officialName: "K-디지털 트레이닝", summary: "디지털 신기술 분야 실무역량 중심 직업훈련", category: "교육", scope: "national", region: "전국", regionCode: "00", leadOrganization: "고용노동부", status: "rolling", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "과정별 상이", eligibility: ["국민내일배움카드 발급 가능 여부", "과정별 선발요건"], benefit: "AI·데이터·반도체 등 훈련과 훈련장려금", applicationPeriod: "과정별 상시", applicationChannel: "고용24", sourceId: "src-youthcenter", lifeSituations: ["새 기술을 배우고 싶어요"] },
  { slug: "future-work-experience", officialName: "미래내일 일경험 사업", summary: "청년에게 기업 프로젝트·인턴형 일경험을 제공", category: "일자리", scope: "national", region: "전국", regionCode: "00", leadOrganization: "고용노동부", status: "rolling", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "프로그램 공고 기준", eligibility: ["미취업 청년 중심", "운영기관·프로그램별 요건"], benefit: "프로젝트·인턴·기업탐방형 일경험", applicationPeriod: "프로그램별 모집", applicationChannel: "고용24", sourceId: "src-youthcenter", lifeSituations: ["경력을 시작하고 싶어요"] },
  { slug: "youth-challenge-support", officialName: "청년도전지원사업", summary: "구직단념 청년의 자신감 회복과 노동시장 참여를 지원", category: "일자리", scope: "national", region: "전국", regionCode: "00", leadOrganization: "고용노동부·지방자치단체", status: "rolling", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "지역 운영기관 공고 기준", eligibility: ["구직단념청년 등 유형별 요건", "지역 운영기관 상담"], benefit: "맞춤형 프로그램·참여수당·취업연계", applicationPeriod: "지역별 상이", applicationChannel: "고용24 또는 운영기관", sourceId: "src-youthcenter", lifeSituations: ["다시 시작할 힘이 필요해요"] },
  { slug: "national-learning-card", officialName: "국민내일배움카드", summary: "직업능력개발 훈련비를 지원하는 평생 직업훈련 제도", category: "교육", scope: "national", region: "전국", regionCode: "00", leadOrganization: "고용노동부", status: "rolling", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "연령보다 제외대상 기준 확인", eligibility: ["일부 공무원·고소득자 등 제외기준 확인"], benefit: "훈련비와 요건별 훈련장려금", applicationPeriod: "상시", applicationChannel: "고용24", sourceId: "src-youthcenter", lifeSituations: ["직무역량을 키우고 싶어요"] },
  { slug: "national-work-study", officialName: "국가근로장학금", summary: "대학생에게 교내외 근로기회와 장학금을 제공", category: "교육", scope: "national", region: "전국", regionCode: "00", leadOrganization: "교육부·한국장학재단", status: "closed", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "대학 재학생", eligibility: ["소속대학 참여", "학자금 지원구간·성적 기준"], benefit: "근로시간에 따른 장학금", applicationPeriod: "학기별 신청", applicationChannel: "한국장학재단", sourceId: "src-youthcenter", lifeSituations: ["학비와 생활비가 필요해요"] },
  { slug: "income-contingent-student-loan", officialName: "취업 후 상환 학자금대출", summary: "재학 중 학비를 대출하고 소득 발생 후 상환", category: "금융", scope: "national", region: "전국", regionCode: "00", leadOrganization: "교육부·한국장학재단", status: "closed", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "학제·대출유형별 확인", eligibility: ["대학(원) 재학생", "성적·이수학점·지원구간 기준"], benefit: "등록금 및 생활비 대출", applicationPeriod: "학기별 신청", applicationChannel: "한국장학재단", sourceId: "src-youthcenter", lifeSituations: ["학비가 부담돼요"] },
  { slug: "youth-startup-fund", officialName: "청년전용 창업자금", summary: "기술과 사업성을 갖춘 청년 창업기업에 정책자금을 융자", category: "창업", scope: "national", region: "전국", regionCode: "00", leadOrganization: "중소벤처기업부·중소벤처기업진흥공단", status: "rolling", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "대표자 연령·업력 요건 확인", eligibility: ["청년 대표자", "업력·업종·신용 요건"], benefit: "시설·운전자금 정책융자와 멘토링", applicationPeriod: "예산 소진 시까지", applicationChannel: "중소벤처기업진흥공단", sourceId: "src-youthcenter", lifeSituations: ["창업하고 싶어요"] },
  { slug: "pre-startup-package", officialName: "예비창업패키지", summary: "혁신 아이디어를 가진 예비창업자의 사업화를 지원", category: "창업", scope: "national", region: "전국", regionCode: "00", leadOrganization: "중소벤처기업부·창업진흥원", status: "closed", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "연령 제한은 공고별 트랙 확인", eligibility: ["사업자등록 이력이 없는 예비창업자 등", "공고 제외대상 확인"], benefit: "사업화 자금·창업교육·멘토링", applicationPeriod: "연도별 공고", applicationChannel: "K-Startup", sourceId: "src-youthcenter", lifeSituations: ["처음 창업을 준비해요"] },
  { slug: "early-startup-package", officialName: "초기창업패키지", summary: "초기 창업기업의 시장진입과 성장을 지원", category: "창업", scope: "national", region: "전국", regionCode: "00", leadOrganization: "중소벤처기업부·창업진흥원", status: "closed", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "대표자 연령 제한은 트랙별 확인", eligibility: ["초기 창업기업", "공고 기준 업력·제외업종 확인"], benefit: "사업화 자금·시장검증·투자연계", applicationPeriod: "연도별 공고", applicationChannel: "K-Startup", sourceId: "src-youthcenter", lifeSituations: ["사업을 성장시키고 싶어요"] },
  { slug: "youth-startup-academy", officialName: "청년창업사관학교", summary: "청년 창업자의 사업화 전 과정을 패키지로 지원", category: "창업", scope: "national", region: "전국", regionCode: "00", leadOrganization: "중소벤처기업부·중소벤처기업진흥공단", status: "closed", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "대표자 연령·업력 기준 확인", eligibility: ["청년 대표자", "창업 업력·사업장 기준"], benefit: "사업화 자금·공간·코칭·투자 연계", applicationPeriod: "연도별 공고", applicationChannel: "K-Startup", sourceId: "src-youthcenter", lifeSituations: ["창업을 본격화하고 싶어요"] },
  { slug: "young-farmer-settlement", officialName: "청년농업인 영농정착지원", summary: "초기 영농 청년의 안정적 정착과 성장을 지원", category: "창업", scope: "national", region: "전국", regionCode: "00", leadOrganization: "농림축산식품부", status: "closed", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "독립경영 예정·경력 기준 확인", eligibility: ["독립경영 요건", "소득·병역·교육 요건"], benefit: "영농정착지원금·농지·자금·교육 연계", applicationPeriod: "연도별 공고", applicationChannel: "농림사업정보시스템", sourceId: "src-youthcenter", lifeSituations: ["농업으로 지역에 정착하고 싶어요"] },
  { slug: "young-fisher-settlement", officialName: "청년어촌정착지원", summary: "어업·양식업에 진입한 청년의 어촌 정착을 지원", category: "창업", scope: "national", region: "전국", regionCode: "00", leadOrganization: "해양수산부", status: "closed", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "사업 시행지침 기준 확인", eligibility: ["어업경영 경력", "거주·소득·경영 요건"], benefit: "초기 어업경영비와 정착 지원", applicationPeriod: "지자체별 공고", applicationChannel: "관할 시군구", sourceId: "src-youthcenter", lifeSituations: ["어촌에 정착하고 싶어요"] },
  { slug: "youth-culture-pass", officialName: "청년문화예술패스", summary: "청년의 공연·전시 관람 기회를 넓히는 문화지원", category: "복지·문화", scope: "national", region: "전국", regionCode: "00", leadOrganization: "문화체육관광부·한국문화예술위원회", status: "unknown", verificationStatus: "review_required", age: "해당 연도 출생연도 기준", eligibility: ["지원 대상 출생연도", "지역별 잔여예산 확인"], benefit: "공연·전시 예매비 지원", applicationPeriod: "연도별 공고", applicationChannel: "지정 예매처", sourceId: "src-youthcenter", lifeSituations: ["문화를 누리고 싶어요"] },
  { slug: "youth-mental-health", officialName: "청년마음건강지원사업", summary: "심리상담이 필요한 청년에게 전문 상담서비스를 제공", category: "복지·문화", scope: "national", region: "전국", regionCode: "00", leadOrganization: "보건복지부·지방자치단체", status: "unknown", verificationStatus: "review_required", age: "지역·사업지침 기준 확인", eligibility: ["지역별 접수 가능 여부", "우선지원 대상 확인"], benefit: "전문 심리상담 서비스 바우처", applicationPeriod: "지역별 상이", applicationChannel: "복지로 또는 행정복지센터", sourceId: "src-youthcenter", lifeSituations: ["마음이 너무 힘들어요"] },
  { slug: "regional-youth-jobs", officialName: "지역주도형 청년일자리사업", summary: "지역의 청년고용과 정착을 지역 맞춤형으로 지원", category: "일자리", scope: "regional", region: "전국 지자체", regionCode: "00", leadOrganization: "행정안전부·지방자치단체", status: "unknown", verificationStatus: "review_required", age: "지역 사업 공고 기준", eligibility: ["해당 지역 거주 또는 전입", "세부사업별 고용요건"], benefit: "인건비·직무교육·정착지원 등 지역별 구성", applicationPeriod: "지역별 공고", applicationChannel: "지방자치단체·수행기관", sourceId: "src-youthcenter", lifeSituations: ["지역에서 일하고 싶어요"] },
  { slug: "daejeon-youth-rent", officialName: "대전 청년월세지원사업", summary: "대전 거주 무주택 청년의 월세 부담을 완화", category: "주거", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "unknown", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공고일 기준 확인", eligibility: ["대전 거주", "무주택", "소득·임차조건"], benefit: "실제 월세 범위 내 월별 지원", applicationPeriod: "연도별 공고", applicationChannel: "대전청년포털", sourceId: "src-daejeon", lifeSituations: ["대전에서 월세가 부담돼요"] },
  { slug: "daejeon-future-double-account", officialName: "미래두배 청년통장", summary: "대전 근로청년의 저축액에 시 지원금을 매칭", category: "금융", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "closed", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "18~39세(모집공고 최종 확인)", eligibility: ["대전 거주", "근로 또는 사업소득", "소득기준"], benefit: "2025 회차 기준 월 15만원 24개월 저축 시 시 동일액 매칭", applicationPeriod: "2025-10-20 ~ 2025-10-31", applicationChannel: "대전청년포털 온라인", sourceId: "src-daejeon-account", lifeSituations: ["대전에서 자산을 만들고 싶어요"] },
  { slug: "daejeon-tomorrow-hope-card", officialName: "대전 청년내일희망카드", summary: "미취업 청년의 구직활동비와 취업 준비를 지원", category: "일자리", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "closed", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "18~34세(공식 안내 기준)", eligibility: ["대전 거주", "미취업·미창업", "소득·학력요건 확인"], benefit: "공식 안내 기준 월 50만원씩 6개월, 최대 300만원 구직활동 포인트", applicationPeriod: "회차별 공고", applicationChannel: "희망카드 홈페이지·서류접수", sourceId: "src-daejeon-hope", lifeSituations: ["대전에서 취업을 준비하고 있어요"] },
  { slug: "daejeon-housing-deposit-interest", officialName: "대전 청년·청년부부 주택임차보증금 이자지원", summary: "무주택 청년·청년부부의 전세대출 이자를 지원", category: "주거", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "open", verificationStatus: "verified", lastReviewedAt: "2026-08-24", age: "19~39세", eligibility: ["대전 거주 또는 대전 소재 대학·직장 재적", "무주택", "임차주택·소득기준"], benefit: "청년 최대 1억원 대출추천·이자 2.5%, 청년부부 최대 2억원·최대 3.75%", applicationPeriod: "2026-02-19 ~ 2026-11-30 (예산 소진 시 조기 종료)", applicationChannel: "대전청년포털 온라인", sourceId: "src-daejeon-housing", lifeSituations: ["전세보증금 이자가 부담돼요"] },
  { slug: "daejeon-newlywed-interest", officialName: "대전 청년 신혼부부 전세자금 대출이자 지원", summary: "청년 신혼부부의 주거 안정을 위한 전세자금 이자지원", category: "주거", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "open", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공고 기준 청년부부", eligibility: ["대전 거주·전입 조건", "혼인·무주택·소득 기준"], benefit: "전세자금 대출이자 지원", applicationPeriod: "2026-02-19 ~ 2026-12-11", applicationChannel: "대전청년포털", sourceId: "src-daejeon", lifeSituations: ["신혼집을 구하고 있어요"] },
  { slug: "daejeon-marriage-incentive", officialName: "대전 청년부부 결혼장려금 지원사업", summary: "대전 청년부부의 결혼 초기 정착을 지원", category: "복지·문화", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시", status: "open", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공고 기준 청년부부", eligibility: ["혼인일·거주기간", "부부 연령·전입 요건"], benefit: "청년부부 결혼장려금", applicationPeriod: "2025-12-01 ~ 2026-12-31", applicationChannel: "대전청년포털", sourceId: "src-daejeon", lifeSituations: ["결혼 후 대전에 정착하고 싶어요"] },
  { slug: "daejeon-startup-card", officialName: "대전 청년 창업지원카드", summary: "초기 청년창업자의 간접사업비를 카드 방식으로 지원", category: "창업", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "unknown", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공고일 기준 청년", eligibility: ["대전 거주·사업장", "창업 업력·매출 요건"], benefit: "과거 공식 회차 기준 월 50만원씩 6개월, 최대 300만원 간접사업비", applicationPeriod: "최신 모집공고 확인 필요", applicationChannel: "청년 창업지원카드 홈페이지", sourceId: "src-daejeon-startup", lifeSituations: ["대전에서 창업하고 있어요"] },
  { slug: "daejeon-youth-intern", officialName: "대전 청년인턴 지원", summary: "지역기업과 청년을 연결해 일경험과 취업을 지원", category: "일자리", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시", status: "open", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "세부 공고 확인", eligibility: ["대전 청년", "참여기업·직무별 요건"], benefit: "지역기업 인턴 기회와 취업연계", applicationPeriod: "2026-02-02 ~ 2026-12-31", applicationChannel: "대전일자리정보망·대전청년포털", sourceId: "src-daejeon", lifeSituations: ["대전 기업에서 경력을 시작하고 싶어요"] },
  { slug: "daejeon-youth-meeting", officialName: "청년만남지원사업 연(連) in 대전", summary: "대전 청년의 관계 형성과 지역 정착을 지원하는 만남 프로그램", category: "복지·문화", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시", status: "open", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "세부 공고 확인", eligibility: ["대전 거주·재직 등 회차별 기준"], benefit: "관계형성 프로그램과 지역활동", applicationPeriod: "2026-03-01 ~ 2026-12-01", applicationChannel: "대전청년포털", sourceId: "src-daejeon", lifeSituations: ["지역에서 새로운 관계를 만들고 싶어요"] },
  { slug: "daejeon-youth-space-dududu", officialName: "대전 청년공간 청춘두두두", summary: "청년 활동·교류·프로그램을 위한 지역 거점공간", category: "참여·기반", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "rolling", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공간별 이용기준 확인", eligibility: ["청년 및 청년단체", "프로그램별 신청"], benefit: "공간대관·상담·네트워킹·프로그램", applicationPeriod: "공간 운영일정에 따름", applicationChannel: "대전청년포털", sourceId: "src-daejeon", lifeSituations: ["활동할 공간이 필요해요"] },
  { slug: "daejeon-youth-space-nadlemok", officialName: "대전 청년공간 청춘나들목", summary: "역세권 접근성을 갖춘 청년 활동·정책 연결 공간", category: "참여·기반", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "rolling", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공간별 이용기준 확인", eligibility: ["청년 및 청년단체", "프로그램별 신청"], benefit: "공간대관·상담·정책안내·커뮤니티", applicationPeriod: "공간 운영일정에 따름", applicationChannel: "대전청년포털", sourceId: "src-daejeon", lifeSituations: ["가까운 청년공간을 찾고 있어요"] },
  { slug: "daejeon-youth-space-neonadeuli", officialName: "대전 청년공간 청춘너나들이", summary: "생활권에서 청년의 모임과 성장을 지원하는 열린 공간", category: "참여·기반", scope: "regional", region: "대전", regionCode: "30", leadOrganization: "대전광역시·대전청년내일재단", status: "rolling", verificationStatus: "partially_verified", lastReviewedAt: "2026-08-24", age: "공간별 이용기준 확인", eligibility: ["청년 및 청년단체", "프로그램별 신청"], benefit: "공간대관·커뮤니티·역량강화 프로그램", applicationPeriod: "공간 운영일정에 따름", applicationChannel: "대전청년포털", sourceId: "src-daejeon", lifeSituations: ["청년들과 연결되고 싶어요"] },
];

export const policies: PolicyRecord[] = policySeeds.map((seed, index) => {
  const id = `YH-POL-${String(index + 1).padStart(4, "0")}`;
  return {
    ...seed,
    id,
    programId: `YH-PRG-${String(index + 1).padStart(4, "0")}`,
    roundId: `YH-RND-${String(index + 1).padStart(4, "0")}-2026`,
    aliases: [],
    purpose: seed.purpose ?? seed.summary,
    firstObservedAt: "2026-08-24",
    lastObservedAt: "2026-08-24",
    requiredDocuments: ["신청서", "자격 확인서류(공식 공고 기준)"],
    budget: "공개 예산자료 연결 준비 중",
    legalBasis: seed.legalBasis ?? "공식 사업지침·모집공고",
    relatedPolicyIds: (seed.related ?? []).map(
      (n) => `YH-POL-${String(n).padStart(4, "0")}`,
    ),
  };
});

export const changes: ChangeEvent[] = [
  {
    id: "YH-CHG-0001",
    policyId: "YH-POL-0024",
    type: "모집 시작",
    field: "applicationPeriod",
    previousValue: "2025년 회차 종료",
    currentValue: "2026-02-19 ~ 2026-11-30",
    announcedAt: "2026-02-19",
    effectiveAt: "2026-02-19",
    detectedAt: "2026-08-24T10:42:00+09:00",
    impact: "high",
    verificationStatus: "verified",
    summary: "2026년 대전 청년·청년부부 주택임차보증금 이자지원 회차가 연결되었습니다.",
    sourceId: "src-daejeon-housing",
  },
  {
    id: "YH-CHG-0002",
    policyId: "YH-POL-0024",
    type: "지원 변경",
    field: "benefit",
    previousValue: "이전 회차 조건",
    currentValue: "청년 2.5%, 청년부부 최대 3.75% 이자 지원",
    detectedAt: "2026-08-24T09:10:00+09:00",
    impact: "high",
    verificationStatus: "verified",
    summary: "2026년 공식 안내의 대상별 이자지원율을 구조화했습니다.",
    sourceId: "src-daejeon-housing",
  },
  {
    id: "YH-CHG-0003",
    policyId: "YH-POL-0028",
    type: "신규",
    field: "registry",
    previousValue: "미등록",
    currentValue: "정책 레지스트리 등록",
    detectedAt: "2026-08-24T08:45:00+09:00",
    impact: "informational",
    verificationStatus: "partially_verified",
    summary: "대전 청년인턴 지원사업을 지역 정책 레지스트리에 신규 연결했습니다.",
    sourceId: "src-daejeon",
  },
  {
    id: "YH-CHG-0004",
    policyId: "YH-POL-0025",
    type: "모집 시작",
    field: "status",
    previousValue: "회차 준비",
    currentValue: "신청접수중",
    detectedAt: "2026-08-23T17:30:00+09:00",
    impact: "medium",
    verificationStatus: "partially_verified",
    summary: "대전 청년 신혼부부 전세자금 대출이자 지원의 접수 상태를 감지했습니다.",
    sourceId: "src-daejeon",
  },
  {
    id: "YH-CHG-0005",
    policyId: "YH-POL-0026",
    type: "문서 변경",
    field: "applicationPeriod",
    previousValue: "2025년 회차",
    currentValue: "2026년 신청 정보 연결",
    detectedAt: "2026-08-23T14:10:00+09:00",
    impact: "medium",
    verificationStatus: "partially_verified",
    summary: "청년부부 결혼장려금의 2026년 접수기간 정보를 연결했습니다.",
    sourceId: "src-daejeon",
  },
  {
    id: "YH-CHG-0006",
    policyId: "YH-POL-0022",
    type: "문서 변경",
    field: "applicationPeriod",
    previousValue: "모집 전",
    currentValue: "2025 회차 종료·차기 공고 대기",
    detectedAt: "2026-08-22T11:20:00+09:00",
    impact: "low",
    verificationStatus: "verified",
    summary: "미래두배 청년통장 2025 회차를 종료 상태로 보존했습니다.",
    sourceId: "src-daejeon-account",
  },
  {
    id: "YH-CHG-0007",
    policyId: "YH-POL-0018",
    type: "문서 변경",
    field: "verificationStatus",
    previousValue: "부분 검증",
    currentValue: "최신 회차 검토 필요",
    detectedAt: "2026-08-22T09:00:00+09:00",
    impact: "low",
    verificationStatus: "review_required",
    summary: "청년문화예술패스의 최신 회차 정보가 필요해 검증대장에 등록했습니다.",
    sourceId: "src-youthcenter",
  },
  {
    id: "YH-CHG-0008",
    policyId: "YH-POL-0006",
    type: "문서 변경",
    field: "source",
    previousValue: "정책 목록",
    currentValue: "공식 통합검색 원천 연결",
    detectedAt: "2026-08-21T16:40:00+09:00",
    impact: "informational",
    verificationStatus: "verified",
    summary: "K-디지털 트레이닝의 공식 정책 원천을 연결했습니다.",
    sourceId: "src-youthcenter",
  },
];

const indicatorSeeds = [
  ["youth-population", "청년인구", "인구", "명", "주민등록인구현황"],
  ["youth-share", "청년인구 비중", "인구", "%", "주민등록인구현황"],
  ["net-migration", "청년 순이동", "이동·정착", "명", "국내인구이동통계"],
  ["employment-rate", "청년 고용률", "고용", "%", "경제활동인구조사"],
  ["unemployment-rate", "청년 실업률", "고용", "%", "경제활동인구조사"],
  ["neet-rate", "청년 비경제활동 비중", "고용", "%", "경제활동인구조사"],
  ["monthly-income", "청년 월평균 근로소득", "소득", "원", "청년 삶 실태조사"],
  ["rent-burden", "청년 임차가구 주거비 부담", "주거", "%", "주거실태조사"],
  ["housing-tenure", "청년가구 점유형태", "주거", "%", "주거실태조사"],
  ["startup-rate", "청년 대표자 사업체", "창업", "개", "기업생멸행정통계"],
  ["mental-health", "청년 삶의 만족도", "건강", "점", "청년 삶 실태조사"],
  ["policy-participation", "청년정책 인지도", "정책참여", "%", "청년 삶 실태조사"],
] as const;

export const indicators: IndicatorRecord[] = indicatorSeeds.map(
  ([id, name, category, unit, tableName], index) => ({
    id: `YH-IND-${String(index + 1).padStart(3, "0")}-${id}`,
    name,
    category,
    unit,
    organization: "국가데이터처·통계작성기관",
    tableName,
    frequency: index < 6 ? "월·분기 또는 연간" : "연간·조사주기별",
    status: index < 4 ? "snapshot" : "key_required",
    basisDate: "원천 API 연동 후 표시",
    sourceId: "src-kosis",
    limitations: "연령구간과 공표주기가 통계표마다 달라 직접 비교 전 메타데이터 확인이 필요합니다.",
  }),
);

export const regions = [
  ["서울", "11"], ["부산", "26"], ["대구", "27"], ["인천", "28"],
  ["광주", "29"], ["대전", "30"], ["울산", "31"], ["세종", "36"],
  ["경기", "41"], ["강원", "51"], ["충북", "43"], ["충남", "44"],
  ["전북", "52"], ["전남", "46"], ["경북", "47"], ["경남", "48"], ["제주", "50"],
].map(([name, code]) => ({
  name,
  code,
  policyCount: policies.filter((policy) => policy.regionCode === code || policy.regionCode === "00").length,
  localCount: policies.filter((policy) => policy.regionCode === code).length,
}));

export function getPolicy(idOrSlug: string) {
  return policies.find((policy) => policy.id === idOrSlug || policy.slug === idOrSlug);
}

export function getSource(id: string) {
  return sources.find((source) => source.id === id);
}

export function formatVerification(status: VerificationStatus) {
  return {
    verified: "검증 완료",
    partially_verified: "부분 검증",
    review_required: "검증 필요",
    machine_detected: "자동 감지",
  }[status];
}

export function formatPolicyStatus(status: PolicyStatus) {
  return {
    open: "신청 가능",
    upcoming: "모집 예정",
    rolling: "상시·수시",
    closed: "모집 종료",
    unknown: "최신 공고 확인",
  }[status];
}

export const pulse = {
  registered: policies.length,
  active: policies.filter((policy) => ["open", "rolling"].includes(policy.status)).length,
  open: policies.filter((policy) => policy.status === "open").length,
  detectedToday: changes.filter((change) => change.detectedAt.startsWith(snapshot.basisDate)).length,
  verified: policies.filter((policy) => policy.verificationStatus === "verified").length,
  sourceCount: sources.length,
};

