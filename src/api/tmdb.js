import axios from 'axios'

// TMDB 인증은 선택 사항이다. 없으면 포스터만 생략되고 나머지는 그대로 동작한다.
// v4 읽기 토큰(Bearer)을 쓴다. v3 키처럼 쿼리에 붙이지 않고 헤더로 보낸다.
const TOKEN = import.meta.env.VITE_TMDB_TOKEN

export const hasTmdbKey = Boolean(TOKEN)

const api = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  timeout: 8000,
  headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
})

/** 포스터 이미지 주소 (w185 = 가로 185px) */
const posterUrl = (path) => (path ? `https://image.tmdb.org/t/p/w185${path}` : null)

// 같은 제목을 반복 조회하지 않도록 기억해 둔다 (박스오피스는 목록이 자주 겹친다)
const cache = new Map()

/**
 * 영화 제목으로 포스터를 찾는다.
 * @param {string} title KOFIC이 준 한글 제목
 * @param {string} openDt "2026-07-29" (있으면 연도로 후보를 좁힌다)
 */
export const fetchPoster = async (title, openDt = '') => {
  if (!TOKEN) return null

  const year = openDt.slice(0, 4)
  const cacheKey = `${title}|${year}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    const { data } = await api.get('/search/movie', {
      params: {
        query: title,
        language: 'ko-KR',
        ...(year ? { primary_release_year: year } : {}),
      },
    })

    // 개봉연도로 못 찾으면 연도 조건 없이 한 번 더 시도한다
    let hit = data.results?.[0]
    if (!hit && year) {
      const retry = await api.get('/search/movie', {
        params: { query: title, language: 'ko-KR' },
      })
      hit = retry.data.results?.[0]
    }

    const result = hit
      ? { poster: posterUrl(hit.poster_path), overview: hit.overview, voteAverage: hit.vote_average }
      : null

    cache.set(cacheKey, result)
    return result
  } catch (err) {
    // 포스터는 부가 정보이므로 실패해도 화면을 막지 않는다
    console.warn(`⚠️ [TMDB] '${title}' 포스터 조회 실패:`, err.message)
    cache.set(cacheKey, null)
    return null
  }
}
