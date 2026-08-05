/**
 * AI 뉴스 - 구글 뉴스 RSS
 *
 * 왜 이 조합인가
 *   구글 뉴스 RSS에는 CORS 헤더가 없어 브라우저에서 직접 못 읽는다.
 *   rss2json이 RSS를 JSON으로 바꿔 주면서 Access-Control-Allow-Origin: * 을 붙여 준다.
 *   덕분에 서버 없이 정적 사이트에서 실제 언론사 기사를 가져올 수 있다.
 *
 *   (Hacker News는 링크 게시판이라 개인 블로그·토론이 대부분이었다.
 *    여기서는 연합뉴스·조선일보·전자신문 같은 실제 매체의 기사만 들어온다)
 */

const RSS2JSON = 'https://api.rss2json.com/v1/api.json'

/** 구글 뉴스 검색 RSS 주소 (한국어) */
const googleNews = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`

// 검색어 하나로는 놓치는 기사가 많아 여러 갈래로 던진 뒤 합친다
const QUERIES = ['AI', '인공지능', '생성형 AI', 'OpenAI', '챗GPT', 'LLM', 'AI 반도체', 'AI 규제']

export const RANGES = {
  // when: 은 구글 뉴스 검색 연산자. 1d = 하루, 7d = 일주일.
  daily: { label: '일간', operator: 'when:1d', hours: 24 },
  weekly: { label: '주간', operator: 'when:7d', hours: 168 },
}

/**
 * 주제 분류.
 *
 * 위에서부터 검사해 처음 걸리는 갈래로 넣는다. (순서가 곧 우선순위)
 * 규제 기사가 '논란'에도 걸리므로, 더 좁은 갈래를 위에 둔다.
 */
export const TOPICS = [
  {
    id: 'policy',
    label: '정책 · 규제',
    hint: '정부와 국회가 움직인 소식입니다.',
    re: /(규제|법안|기본법|입법|국회|정부|부처|과기정통부|방통위|공정위|당국|정책|가이드라인|예산|심의|승인|허가|제재)/,
  },
  {
    id: 'money',
    label: '산업 · 투자',
    hint: '돈이 움직인 소식입니다.',
    re: /(투자|유치|인수|합병|상장|IPO|매출|실적|영업이익|적자|흑자|조달|수주|계약|억원|조원|펀드|주가|시총)/,
  },
  {
    id: 'risk',
    label: '사회 · 논란',
    hint: '부작용과 우려가 불거진 사안입니다.',
    re: /(논란|우려|사기|딥페이크|저작권|윤리|일자리|해고|감원|보안|해킹|악용|피해|위험|중독|가짜|허위|편향|소송|고발|유출)/,
  },
  {
    id: 'product',
    label: '제품 · 서비스',
    hint: '새로 나왔거나 도입된 것들입니다.',
    re: /(출시|공개|선보|적용|도입|탑재|서비스|오픈|출범|업데이트|베타|맞손|협약|MOU|제휴|구축|개시|시작)/,
  },
  {
    id: 'tech',
    label: '기술 · 모델',
    hint: '모델과 인프라 이야기입니다.',
    re: /(모델|개발|연구|성능|학습|알고리즘|논문|벤치마크|반도체|GPU|NPU|데이터센터|추론|파라미터|오픈소스|아키텍처|기술)/,
  },
]

const OTHER = { id: 'other', label: '그 밖에', hint: '위 갈래에 들어가지 않은 소식입니다.' }

export const ALL_TOPICS = [...TOPICS, OTHER]

const classify = (title) => (TOPICS.find((t) => t.re.test(title)) ?? OTHER).id

/**
 * rss2json이 주는 시각은 UTC인데 "2026-08-05 06:15:00" 처럼 표시가 없다.
 * 그냥 new Date()에 넣으면 브라우저가 현지 시각으로 읽어 9시간이 어긋난다.
 */
const parseDate = (text) => new Date(`${text.replace(' ', 'T')}Z`)

/** "3시간 전" */
export const timeAgo = (date) => {
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

/** 검색어 하나로 조회 */
const searchOne = async (query) => {
  const url = `${RSS2JSON}?rss_url=${encodeURIComponent(googleNews(query))}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`뉴스 조회 실패 (${res.status})`)

  const data = await res.json()
  if (data.status !== 'ok') throw new Error('뉴스 응답이 올바르지 않습니다.')
  return data.items ?? []
}

/**
 * 기간 안의 AI 기사를 모아 최신순으로 돌려준다.
 *
 * @param {'daily'|'weekly'} range
 */
export const fetchAiNews = async (range = 'weekly') => {
  const window = RANGES[range] ?? RANGES.weekly

  const results = await Promise.allSettled(QUERIES.map((q) => searchOne(`${q} ${window.operator}`)))
  const failed = QUERIES.filter((_, i) => results[i].status === 'rejected')
  const raw = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

  if (!raw.length && failed.length === QUERIES.length) {
    throw new Error('뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }

  // 같은 기사가 검색어마다 중복으로 온다. 제목으로 한 번만 남긴다.
  const seen = new Map()
  const cutoff = Date.now() - window.hours * 3600 * 1000

  for (const it of raw) {
    if (!it.title) continue

    // 구글 뉴스 제목은 "기사 제목 - 언론사" 형식이다
    const cut = it.title.lastIndexOf(' - ')
    const title = cut > 0 ? it.title.slice(0, cut) : it.title
    const source = cut > 0 ? it.title.slice(cut + 3) : ''

    const key = title.replace(/\s+/g, '')
    if (seen.has(key)) continue

    const date = parseDate(it.pubDate)
    // when: 연산자가 느슨해서 기간 밖 기사가 섞여 들어오기도 한다
    if (date.getTime() < cutoff) continue

    seen.set(key, { id: key, title, source, url: it.link, date, topic: classify(title) })
  }

  const list = [...seen.values()].sort((a, b) => b.date - a.date)
  return { list, failed }
}
