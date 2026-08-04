<script setup>
import { ref, watch } from 'vue'
import DitherBackdrop from '@/components/DitherBackdrop.vue'
import WeatherEffect from '@/components/WeatherEffect.vue'
import { fxMode } from '@/utils/weatherFx.js'
// [실습] 과제 - 날씨 (컴포넌트) 158쪽
import { RouterLink, RouterView } from 'vue-router'
import UnitToggler from '@/components/exercise/UnitToggler.vue'

/* ---------------- 다크 / 라이트 모드 ---------------- */
// index.html에서 미리 적용해 둔 클래스를 초기값으로 읽는다
const isDark = ref(document.documentElement.classList.contains('theme-dark'))

// 값이 바뀔 때마다 html 태그의 클래스와 localStorage를 갱신
watch(isDark, (dark) => {
  document.documentElement.classList.toggle('theme-dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
})
</script>

<template>
  <!-- 배경: 흑백 디더링 도트 (고정, 콘텐츠 뒤) -->
  <DitherBackdrop />
  <!-- 선택한 지역이 비/눈이면 화면 전체에 내리는 효과 -->
  <WeatherEffect :mode="fxMode" />

  <!-- 상단 고정 네비게이션 -->
  <nav class="top-nav">
    <div class="top-nav-inner">
      <RouterLink to="/" class="logo-link" aria-label="홈">
        <span class="logo">&gt;<span class="logo-caret">_</span></span>
      </RouterLink>

      <!-- 페이지 라우팅 Navigation Bar (RouterLink) -->
      <ul class="nav-links">
        <li><RouterLink to="/">날씨 대시보드</RouterLink></li>
        <li><RouterLink to="/challenges">코드 챌린지</RouterLink></li>
        <li><RouterLink to="/about">소개</RouterLink></li>
      </ul>

      <div class="nav-actions">
        <!-- 요구사항 2) Navigation Bar 옆 단위 전환 -->
        <UnitToggler />

        <button
          class="icon-btn"
          :aria-label="isDark ? '라이트 모드로' : '다크 모드로'"
          @click="isDark = !isDark"
        >
          <svg
            v-if="isDark"
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>
    </div>
  </nav>

  <!-- 배경 위에 떠 있는 콘텐츠 카드 -->
  <div class="container">
    <!-- 요구사항 2) 메인 콘텐츠 영역 -->
    <main class="practice-container">
      <RouterView />
    </main>

    <footer class="site-footer">
      <span class="eyebrow">Console</span>
    </footer>
  </div>
</template>

<style>
/* 실습 공통 스타일 (전역) */
@import '@/assets/practice.css';
@import '@/assets/exercise.css';

/* 배경이 보이도록 페이지 자체는 투명하게 두고, 다크모드에선 도트를 반전 */
body {
  background: transparent;
}

.theme-dark .shader-bg {
  filter: invert(1);
}
</style>

<style scoped>
/* ---------------- 상단 네비 ---------------- */
.top-nav {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: calc(var(--container-max) + 128px);
  height: var(--nav-height);
  background: var(--nav-bg);
  border: 1px solid var(--border);
  border-top: 0;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
}

.top-nav-inner {
  height: 100%;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
}

.logo-caret {
  color: var(--accent);
  animation: blink 1.2s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-link:hover {
  color: inherit;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.nav-links a {
  display: inline-block;
  padding: 4px 10px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-muted);
}

.nav-links a:hover {
  color: var(--text);
  background: var(--bg-hover);
}

/* 현재 페이지 링크는 라우터가 자동으로 이 클래스를 붙여준다 */
.nav-links a.router-link-exact-active {
  color: var(--bg);
  background: var(--text);
}

.nav-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
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

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

/* ---------------- 배경 위에 뜬 콘텐츠 카드 ---------------- */
.container {
  position: relative;
  z-index: 1;
  max-width: calc(var(--container-max) + 128px);
  margin: 72px auto 40px;
  padding: 4px 40px 40px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}

.page-banner {
  padding: 48px 0 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 32px;
}

.page-title {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 6px 0 0;
}

.page-desc {
  margin-top: 10px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* ---------------- 푸터 ---------------- */
.site-footer {
  margin-top: 48px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.site-footer p {
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--text-muted);
}

kbd {
  padding: 1px 5px;
  border: 1px solid var(--border);
  background: var(--bg-hover);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

@media (max-width: 750px) {
  .top-nav {
    max-width: 100%;
    border: 0;
    border-bottom: 1px solid var(--border);
  }
  .top-nav-inner {
    padding: 0 20px;
  }
  .container {
    margin: 64px 16px 32px;
    padding: 4px 20px 32px;
  }
  .page-title {
    font-size: 1.7rem;
  }
}
</style>
