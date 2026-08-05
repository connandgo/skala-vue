/**
 * 뉴스 - public/news.json 을 읽는다.
 *
 *   일간 - 구글 뉴스 RSS로 모은 국내 AI 기사
 *   주간 - GeekNews Weekly 최신 호 (에디터 글 + 주요 뉴스)
 *
 * 두 곳 다 CORS 헤더가 없어 브라우저에서 직접 못 읽는다.
 * GitHub Actions가 미리 받아 두고(scripts/fetch-news.mjs), 화면은 그 파일만 읽는다.
 */

const SRC = `${import.meta.env.BASE_URL}news.json`

export const RANGES = {
  daily: { label: '일간' },
  weekly: { label: '주간' },
}

/**
 * 일간 기사 주제 분류.
 * 위에서부터 검사해 처음 걸리는 갈래로 넣는다. (순서가 곧 우선순위)
 * 규제 기사가 '논란'에도 걸리므로 더 좁은 갈래를 위에 둔다.
 */
export const TOPICS = [
  {
    id: 'policy',
    label: '정책 · 규제',
    re: /(규제|법안|기본법|입법|국회|정부|부처|과기정통부|방통위|공정위|당국|정책|가이드라인|예산|심의|승인|허가|제재)/,
  },
  {
    id: 'money',
    label: '산업 · 투자',
    re: /(투자|유치|인수|합병|상장|IPO|매출|실적|영업이익|적자|흑자|조달|수주|계약|억원|조원|펀드|주가|시총)/,
  },
  {
    id: 'risk',
    label: '사회 · 논란',
    re: /(논란|우려|사기|딥페이크|저작권|윤리|일자리|해고|감원|보안|해킹|악용|피해|위험|중독|가짜|허위|편향|소송|고발|유출)/,
  },
  {
    id: 'product',
    label: '제품 · 서비스',
    re: /(출시|공개|선보|적용|도입|탑재|서비스|오픈|출범|업데이트|베타|맞손|협약|MOU|제휴|구축|개시)/,
  },
  {
    id: 'tech',
    label: '기술 · 모델',
    re: /(모델|개발|연구|성능|학습|알고리즘|논문|벤치마크|반도체|GPU|NPU|데이터센터|추론|파라미터|오픈소스|기술)/,
  },
]

const OTHER = { id: 'other', label: '그 밖에' }

export const ALL_TOPICS = [...TOPICS, OTHER]

/**
 * 화면에 내보내는 순서.
 *
 * TOPICS 순서는 '분류 우선순위'라서 바꾸면 기사가 다른 갈래로 넘어간다.
 * (기술 규칙이 넓어서 맨 위에 두면 대부분이 기술로 빨려 들어간다)
 * 그래서 보여 주는 순서만 따로 둔다.
 */
export const DAILY_ORDER = ['tech', 'product', 'money', 'policy', 'risk', 'other']

const classify = (title) => (TOPICS.find((t) => t.re.test(title)) ?? OTHER).id

/** "3시간 전" */
export const timeAgo = (date) => {
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

let cached = null

/** 파일은 한 번만 읽고 재사용한다 (일간/주간 전환 때 다시 받지 않도록) */
export const fetchNews = async () => {
  if (cached) return cached

  const res = await fetch(SRC, { cache: 'no-cache' })
  if (!res.ok) throw new Error('뉴스 파일을 읽지 못했습니다.')

  const data = await res.json()

  cached = {
    fetchedAt: new Date(data.fetchedAt),
    daily: (data.daily ?? []).map((it) => ({
      ...it,
      date: new Date(it.published),
      topic: classify(it.title),
    })),
    weekly: data.weekly ?? null,
  }
  return cached
}
