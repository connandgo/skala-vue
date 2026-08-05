import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * 데모용 계정 저장소.
 *
 * 서버가 없는 정적 사이트라, 계정은 이 브라우저의 localStorage에만 남는다.
 * 다른 기기에서는 보이지 않고, 방문자끼리 공유되지도 않는다.
 *
 * 비밀번호는 그대로 두지 않고 SHA-256으로 바꿔서 넣는다.
 * 어차피 로컬이지만, 저장소를 열었을 때 평문이 보이는 건 나쁜 습관이다.
 *
 * 계정에는 즐겨찾는 지역과 화면 설정도 함께 담는다.
 * 로그인해도 아무것도 달라지지 않으면 계정이 있을 이유가 없다.
 */

const ACCOUNTS_KEY = 'skala-accounts'
const SESSION_KEY = 'skala-session'

/** 계정마다 딸려 오는 설정의 초기값 */
const emptyPrefs = () => ({
  favorites: [], // 즐겨찾는 지역 id
  unit: 'celsius',
  theme: '', // '' 이면 기기 설정을 따른다
})

/** 문자열 -> SHA-256 16진수 */
const sha256 = async (text) => {
  // crypto.subtle은 https나 localhost에서만 쓸 수 있다.
  // 사내망 http로 열었을 때를 위해 대체 경로를 둔다. (데모 계정이라 이 정도로 충분하다)
  if (!globalThis.crypto?.subtle) {
    let h = 0
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
    return `plain-${h}`
  }

  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 저장된 계정을 읽는다.
 * 예전에는 아이디마다 해시 문자열만 넣었다. 그 형태도 읽을 수 있게 맞춰 준다.
 */
const readAccounts = () => {
  let raw
  try {
    raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}')
  } catch {
    return {}
  }

  const out = {}
  for (const [id, value] of Object.entries(raw)) {
    out[id] =
      typeof value === 'string'
        ? { hash: value, prefs: emptyPrefs() } // 옛 형태
        : { hash: value.hash, prefs: { ...emptyPrefs(), ...(value.prefs ?? {}) } }
  }
  return out
}

const writeAccounts = (accounts) => {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    /* 저장 공간이 막혀 있으면 이번 세션에서만 유지된다 */
  }
}

/** 비밀번호 강도 (0~4). 화면에 막대로 보여 준다. */
export const passwordScore = (pw) => {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(4, score)
}

export const SCORE_LABEL = ['너무 약함', '약함', '보통', '좋음', '아주 좋음']

/** 아이디 규칙: 영문 소문자·숫자·밑줄 2~16자 */
export const ID_RULE = /^[a-z0-9_]{2,16}$/

/**
 * 이미 쓰는 아이디인지 본다.
 * 서버가 아니라 이 브라우저의 저장소를 뒤지는 것이라, 다른 기기의 가입은 모른다.
 */
export const isTakenId = (id) => Boolean(readAccounts()[id])

export const useAuthStore = defineStore('auth', () => {
  // state
  const userId = ref(localStorage.getItem(SESSION_KEY) ?? '')
  const prefs = ref(emptyPrefs())

  // 새로고침해도 로그인 상태가 남아 있으니, 저장된 설정을 바로 불러온다
  if (userId.value) {
    const saved = readAccounts()[userId.value]
    if (saved) prefs.value = saved.prefs
    else userId.value = '' // 계정이 지워졌으면 세션도 버린다
  }

  // getters
  const isLoggedIn = computed(() => userId.value !== '')
  const favorites = computed(() => prefs.value.favorites)

  /* ---------------------------------------------------------------- 계정 */

  const signUp = async (id, password) => {
    const accounts = readAccounts()
    if (accounts[id]) throw new Error('이미 있는 아이디입니다.')

    accounts[id] = { hash: await sha256(password), prefs: emptyPrefs() }
    writeAccounts(accounts)

    userId.value = id
    prefs.value = accounts[id].prefs
    localStorage.setItem(SESSION_KEY, id)
  }

  const logIn = async (id, password) => {
    const accounts = readAccounts()
    const account = accounts[id]
    if (!account) throw new Error('없는 아이디입니다.')
    if (account.hash !== (await sha256(password))) {
      throw new Error('비밀번호가 맞지 않습니다.')
    }

    userId.value = id
    prefs.value = account.prefs
    localStorage.setItem(SESSION_KEY, id)
  }

  const logOut = () => {
    userId.value = ''
    prefs.value = emptyPrefs()
    localStorage.removeItem(SESSION_KEY)
  }

  /** 계정을 지운다. 되돌릴 수 없다. */
  const removeAccount = () => {
    if (!userId.value) return
    const accounts = readAccounts()
    delete accounts[userId.value]
    writeAccounts(accounts)
    logOut()
  }

  /* ---------------------------------------------------------------- 설정 */

  /** 지금 로그인한 계정에 설정을 써 넣는다 */
  const persist = () => {
    if (!userId.value) return
    const accounts = readAccounts()
    if (!accounts[userId.value]) return
    accounts[userId.value].prefs = { ...prefs.value }
    writeAccounts(accounts)
  }

  const savePref = (key, value) => {
    if (!userId.value) return
    prefs.value = { ...prefs.value, [key]: value }
    persist()
  }

  const isFavorite = (cityId) => prefs.value.favorites.includes(cityId)

  /** 즐겨찾기를 켜고 끈다 */
  const toggleFavorite = (cityId) => {
    if (!userId.value) return
    const list = prefs.value.favorites
    prefs.value = {
      ...prefs.value,
      favorites: list.includes(cityId) ? list.filter((v) => v !== cityId) : [...list, cityId],
    }
    persist()
  }

  return {
    userId,
    prefs,
    isLoggedIn,
    favorites,
    isTakenId,
    signUp,
    logIn,
    logOut,
    removeAccount,
    savePref,
    isFavorite,
    toggleFavorite,
  }
})
