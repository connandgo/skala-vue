<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useConfigStore } from '@/stores/configStore'
import AuthDialog from '@/components/AuthDialog.vue'
import { CITIES } from '@/data/cities.js'

/**
 * 상단 네비의 계정 영역.
 *
 * 버튼 두 개(로그인/회원가입)를 늘어놓는 대신 사람 아이콘 하나만 둔다.
 * 누르면 상태에 맞는 메뉴가 열린다.
 *   로그아웃 상태 - 로그인 / 회원가입
 *   로그인 상태   - 저장된 설정, 즐겨찾는 지역, 로그아웃, 탈퇴
 */

const auth = useAuthStore()
const config = useConfigStore()

const open = ref(false)
const dialogMode = ref('') // '' 이면 닫힘
const confirmDelete = ref(false)

const rootRef = ref(null)

/** 즐겨찾는 지역 id를 사람이 읽는 이름으로 */
const favoriteNames = computed(() =>
  auth.favorites.map((id) => CITIES.find((c) => c.id === id)?.name ?? id),
)

const openDialog = (mode) => {
  dialogMode.value = mode
  open.value = false
}

const doLogOut = () => {
  auth.logOut()
  open.value = false
  confirmDelete.value = false
}

const doRemove = () => {
  auth.removeAccount()
  open.value = false
  confirmDelete.value = false
}

/** 바깥을 누르면 닫는다 */
const onDocClick = (e) => {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target)) {
    open.value = false
    confirmDelete.value = false
  }
}

const onKey = (e) => {
  if (e.key === 'Escape') {
    open.value = false
    confirmDelete.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="rootRef" class="auth">
    <button
      class="icon-btn"
      :class="{ on: auth.isLoggedIn }"
      :aria-label="auth.isLoggedIn ? `${auth.userId} 계정` : '계정'"
      :aria-expanded="open"
      @click="open = !open"
    >
      <!-- 사람 아이콘. 로그인하면 속을 채워 상태를 알린다. -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        :fill="auth.isLoggedIn ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>

    <div v-if="open" class="menu">
      <!-- 로그아웃 상태 -->
      <template v-if="!auth.isLoggedIn">
        <p class="menu-lede">로그인하면 즐겨찾는 지역과 화면 설정이 계정에 남습니다.</p>
        <button type="button" @click="openDialog('login')">로그인</button>
        <button type="button" @click="openDialog('signup')">회원가입</button>
      </template>

      <!-- 로그인 상태 -->
      <template v-else>
        <div class="who">
          <span class="who-id">{{ auth.userId }}</span>
          <span class="who-sub">이 브라우저에 저장됨</span>
        </div>

        <dl class="saved">
          <div>
            <dt>온도 단위</dt>
            <dd>{{ config.unit === 'celsius' ? '섭씨 ℃' : '화씨 ℉' }}</dd>
          </div>
          <div>
            <dt>즐겨찾는 지역</dt>
            <dd>
              {{ favoriteNames.length ? favoriteNames.join(', ') : '없음' }}
            </dd>
          </div>
        </dl>

        <p v-if="!favoriteNames.length" class="menu-hint">
          날씨 대시보드의 지역 목록에서 ☆ 를 누르면 여기에 담깁니다.
        </p>

        <button type="button" @click="doLogOut">로그아웃</button>

        <template v-if="!confirmDelete">
          <button type="button" class="danger" @click="confirmDelete = true">계정 삭제</button>
        </template>
        <template v-else>
          <p class="menu-hint warn">지운 계정과 저장된 설정은 되돌릴 수 없습니다.</p>
          <div class="confirm">
            <button type="button" @click="confirmDelete = false">취소</button>
            <button type="button" class="danger" @click="doRemove">삭제합니다</button>
          </div>
        </template>
      </template>
    </div>
  </div>

  <AuthDialog v-if="dialogMode" :mode="dialogMode" @close="dialogMode = ''" />
</template>

<style scoped>
.auth {
  position: relative;
  display: flex;
  align-items: center;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
}

.icon-btn:hover,
.icon-btn.on {
  background: var(--bg-hover);
  color: var(--text);
}

/* ---------------- 드롭다운 ---------------- */
.menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 1200;
  width: 232px;
  padding: 12px;
  border: 1px solid var(--border-strong);
  background: var(--bg);
}

.menu > button {
  display: block;
  width: 100%;
  margin: 0 0 6px;
  padding: 7px;
  font-size: 0.8rem;
}

.menu > button:last-child {
  margin-bottom: 0;
}

.menu-lede {
  margin: 0 0 10px;
  font-size: 0.74rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.who {
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.who-id {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 600;
}

.who-sub {
  font-size: 0.68rem;
  color: var(--text-muted);
}

/* ---------------- 저장된 설정 ---------------- */
.saved {
  margin: 0 0 10px;
}

.saved > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;
  font-size: 0.75rem;
}

.saved dt {
  flex: 0 0 auto;
  color: var(--text-muted);
}

.saved dd {
  margin: 0;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-hint {
  margin: 0 0 10px;
  font-size: 0.7rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.menu-hint.warn {
  padding: 7px 8px;
  border-left: 2px solid var(--text);
  background: var(--bg-subtle);
  color: var(--text);
}

.danger {
  color: var(--text-muted);
}

.danger:hover {
  border-color: var(--text);
  color: var(--text);
}

.confirm {
  display: flex;
  gap: 6px;
}

.confirm button {
  flex: 1;
  margin: 0;
  padding: 7px;
  font-size: 0.78rem;
}
</style>
