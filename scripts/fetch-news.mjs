/**
 * 뉴스를 미리 받아 public/news.json 으로 저장한다.
 *
 *   일간 - 구글 뉴스 RSS (AI 관련 국내 기사)
 *   주간 - GeekNews Weekly (에디터 글 + 주요 뉴스, 요약문 포함)
 *
 * 왜 빌드 때 받는가
 *   두 곳 다 CORS 헤더가 없어 브라우저에서 직접 못 읽는다.
 *   공개 프록시를 거쳐 봤지만 rss2json은 분당 1회로 막히고
 *   allorigins는 셋에 하나꼴로 실패해 화면이 자주 비었다.
 *   Node에는 CORS가 없으니 여기서 받아 두면 런타임에는 정적 파일만 읽으면 된다.
 *
 * 실행: npm run news
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const OUT = 'public/news.json'
const WEEKLY_INDEX = 'https://news.hada.io/weekly'

// 구글 뉴스는 검색어 하나로는 놓치는 기사가 많아 여러 갈래로 던진다
const DAILY_QUERIES = ['AI', '인공지능', '생성형 AI', 'OpenAI', 'AI 반도체']
const DAILY_LIMIT = 30

/* ---------------------------------------------------------------- 도구 */

const get = async (url, attempts = 3) => {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'skala-vue news collector' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      if (i === attempts) throw err
      await new Promise((r) => setTimeout(r, i * 1500))
    }
  }
  return ''
}

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

const stripTags = (html) =>
  decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/** 태그 안쪽 HTML을 그대로 (CDATA 제거) */
const inner = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))
  if (!m) return ''
  return m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
}

/* ------------------------------------------------------------ 일간 */

/**
 * 구글 뉴스 RSS.
 * 제목이 "기사 제목 - 언론사" 형식이라 잘라서 쓴다.
 */
const fetchDaily = async () => {
  const seen = new Map()

  for (const query of DAILY_QUERIES) {
    const feed =
      'https://news.google.com/rss/search?q=' +
      encodeURIComponent(`${query} when:1d`) +
      '&hl=ko&gl=KR&ceid=KR:ko'

    let xml
    try {
      xml = await get(feed)
    } catch (err) {
      console.warn(`  일간 '${query}' 실패: ${err.message}`)
      continue
    }

    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const full = stripTags(inner(item, 'title'))
      if (!full) continue

      const cut = full.lastIndexOf(' - ')
      const title = cut > 0 ? full.slice(0, cut) : full
      const source = cut > 0 ? full.slice(cut + 3) : ''

      const key = title.replace(/\s+/g, '')
      if (seen.has(key)) continue

      seen.set(key, {
        id: key,
        title,
        source,
        url: stripTags(inner(item, 'link')),
        published: new Date(inner(item, 'pubDate')).toISOString(),
      })
    }
  }

  return [...seen.values()]
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .slice(0, DAILY_LIMIT)
}

/* ------------------------------------------------------------ 주간 */

/** 문단 HTML에서 링크는 살리고 나머지 태그는 버린다 */
const toParagraphs = (html) =>
  [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map(([, p]) => ({
      text: stripTags(p),
      links: [...p.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, url, label]) => ({
        url,
        label: stripTags(label),
      })),
    }))
    .filter((p) => p.text.length > 10)

/** 에디터 글이 AI·데이터 이야기인지 본다 */
const AI_EDITORIAL = /(\bAI\b|LLM|GPT|Claude|Gemini|에이전트|인공지능|머신러닝|딥러닝|데이터|모델)/i

/** 한 호를 통째로 읽는다 */
const parseIssue = async (slug) => {
  const url = `${WEEKLY_INDEX}/${slug}`
  const page = await get(url)

  // "[GN#369] 제목" 에서 호수를 떼어 따로 보관한다
  const rawTitle = stripTags(inner(page, 'h2'))
  const issue = rawTitle.match(/\[(GN#\d+)\]/)?.[1] ?? ''
  const title = rawTitle.replace(/^\[GN#\d+\]\s*/, '')

  const editorialHtml =
    page.match(/<div class=['"]desc weekly-editorial['"]>([\s\S]*?)<\/div>/)?.[1] ?? ''

  // 주요 뉴스 기간 ("2026-07-27 – 2026-08-02")
  const period = stripTags(
    page.match(/<span class=['"]weekly-news-period['"]>([\s\S]*?)<\/span>/)?.[1] ?? '',
  ).replace(/^:\s*/, '')

  // 항목: 제목 + 링크 + 요약
  const items = [...page.matchAll(
    /<li id=['"]topic-(\d+)['"][^>]*class=['"]weekly-topic-item['"][^>]*>\s*<a href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>\s*<div class=['"]content['"]>([\s\S]*?)<\/div>\s*<\/li>/g,
  )].map(([, id, link, name, body]) => ({
    id,
    title: stripTags(name),
    url: link,
    summary: stripTags(body),
  }))

  return { slug, issue, url, title, period, editorial: toParagraphs(editorialHtml), items }
}

/**
 * 주간 호를 가져온다.
 *
 * 주요 뉴스는 최신 호에서 그대로 쓴다.
 * 다만 머리글(에디터 글)은 매주 주제가 달라서, 어떤 주는 AI와 무관하다.
 * 그래서 최근 호들을 훑어 AI·데이터 이야기인 호를 머리글로 고른다.
 * (호수를 박아 두면 다음 주에 낡는다)
 */
const fetchWeekly = async () => {
  const index = await get(WEEKLY_INDEX)
  const slugs = [...new Set([...index.matchAll(/\/weekly\/(\d{6})/g)].map((m) => m[1]))]
    .sort()
    .reverse()
  if (!slugs.length) throw new Error('주간 호수를 찾지 못했습니다.')

  const latest = await parseIssue(slugs[0])
  if (!latest.items.length) throw new Error('주간 항목을 찾지 못했습니다.')

  let headline = latest
  const isAiIssue = (issue) => issue.editorial.some((p) => AI_EDITORIAL.test(p.text))

  if (!isAiIssue(latest)) {
    // 최근 다섯 호까지만 거슬러 올라간다
    for (const slug of slugs.slice(1, 6)) {
      const past = await parseIssue(slug)
      if (past.editorial.length && isAiIssue(past)) {
        headline = past
        break
      }
    }
  }

  return {
    slug: latest.slug,
    issue: latest.issue,
    url: latest.url,
    period: latest.period,
    items: latest.items,
    headline: {
      slug: headline.slug,
      issue: headline.issue,
      url: headline.url,
      title: headline.title,
      editorial: headline.editorial,
    },
  }
}

/* ---------------------------------------------------------------- 실행 */

const main = async () => {
  console.log('뉴스 수집')

  // 한쪽이 실패해도 다른 쪽은 살린다
  const [daily, weekly] = await Promise.allSettled([fetchDaily(), fetchWeekly()])

  if (daily.status === 'rejected') console.warn(`  일간 실패: ${daily.reason.message}`)
  if (weekly.status === 'rejected') console.warn(`  주간 실패: ${weekly.reason.message}`)

  const payload = {
    fetchedAt: new Date().toISOString(),
    daily: daily.status === 'fulfilled' ? daily.value : [],
    weekly: weekly.status === 'fulfilled' ? weekly.value : null,
  }

  if (!payload.daily.length && !payload.weekly) {
    throw new Error('일간·주간 모두 실패했습니다.')
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`)

  console.log(`  일간 ${payload.daily.length}건`)
  console.log(
    payload.weekly
      ? `  주간 ${payload.weekly.issue} · ${payload.weekly.items.length}건` +
        ` / 머리글 ${payload.weekly.headline.issue} · ${payload.weekly.headline.editorial.length}문단`
      : '  주간 없음',
  )
  console.log(`  -> ${OUT}`)
}

main().catch((err) => {
  console.error('수집 실패:', err.message)
  process.exit(1)
})
