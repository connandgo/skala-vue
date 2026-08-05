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
 */

const ACCOUNTS_KEY = 'skala-accounts'
const SESSION_KEY = 'skala-session'

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

/** localStorage에서 계정 목록을 읽는다 (없거나 깨졌으면 빈 객체) */
const readAccounts = () => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

const writeAccounts = (accounts) => {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {
    /* 저장 공간이 막혀 있으면 이번 세션에서만 유지된다 */
  }
}

export const useAuthStore = defineStore('auth', () => {
  // state: 로그인한 아이디. 로그아웃 상태면 빈 문자열.
  const userId = ref(localStorage.getItem(SESSION_KEY) ?? '')

  // getters
  const isLoggedIn = computed(() => userId.value !== '')

  // actions
  /** 회원가입. 성공하면 그대로 로그인 상태가 된다. */
  const signUp = async (id, password) => {
    const accounts = readAccounts()
    if (accounts[id]) throw new Error('이미 있는 아이디입니다.')

    accounts[id] = await sha256(password)
    writeAccounts(accounts)

    userId.value = id
    localStorage.setItem(SESSION_KEY, id)
  }

  const logIn = async (id, password) => {
    const accounts = readAccounts()
    if (!accounts[id]) throw new Error('없는 아이디입니다.')
    if (accounts[id] !== (await sha256(password))) {
      throw new Error('비밀번호가 맞지 않습니다.')
    }

    userId.value = id
    localStorage.setItem(SESSION_KEY, id)
  }

  const logOut = () => {
    userId.value = ''
    localStorage.removeItem(SESSION_KEY)
  }

  return { userId, isLoggedIn, signUp, logIn, logOut }
})
