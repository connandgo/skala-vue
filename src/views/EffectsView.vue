<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import EffectCard from '@/components/effects/EffectCard.vue'
import { SECTIONS, TOTAL } from '@/data/effects.js'

/**
 * 디자인 이펙트 카탈로그
 *
 * 대부분의 데모는 CSS만으로 돈다(effects.css).
 * 여기서는 JS가 필요한 셋만 붙인다 — 스포트라이트 / 스크롤 리빌 / 카운트업.
 */

const rootRef = ref(null)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let observers = []
let timers = []

/** 커서 위치를 CSS 변수로 넘긴다 */
const onSpotMove = (e) => {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

let spotEl = null

onMounted(() => {
  const root = rootRef.value
  if (!root) return

  // 1) 스포트라이트
  spotEl = root.querySelector('.fx-spot')
  if (spotEl) spotEl.addEventListener('mousemove', onSpotMove)

  // 2) 스크롤 리빌 - 화면에 들어오면 자식에 80ms 간격으로 클래스를 붙인다
  const reveal = root.querySelector('.fx-reveal')
  if (reveal) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return
          Array.from(en.target.querySelectorAll('.rv')).forEach((el, i) => {
            timers.push(setTimeout(() => el.classList.add('on'), reduceMotion ? 0 : i * 140))
          })
          io.unobserve(en.target)
        })
      },
      { threshold: 0.4 },
    )
    io.observe(reveal)
    observers.push(io)
  }

  // 3) 카운트업
  const count = root.querySelector('.fx-count .n')
  if (count) {
    const io2 = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return
          io2.unobserve(en.target)

          if (reduceMotion) {
            count.textContent = String(TOTAL)
            return
          }
          let n = 0
          const t = setInterval(() => {
            count.textContent = String(++n)
            if (n >= TOTAL) clearInterval(t)
          }, 45)
          timers.push(t)
        })
      },
      { threshold: 0.5 },
    )
    io2.observe(count)
    observers.push(io2)
  }
})

onUnmounted(() => {
  if (spotEl) spotEl.removeEventListener('mousemove', onSpotMove)
  observers.forEach((io) => io.disconnect())
  timers.forEach((t) => {
    clearTimeout(t)
    clearInterval(t)
  })
  observers = []
  timers = []
})
</script>

<template>
  <div ref="rootRef" class="effects">
    <header class="page-banner">
      <span class="eyebrow">reference</span>
      <h1 class="page-title">디자인 이펙트 카탈로그</h1>
      <p class="page-desc">
        다양한 프론트엔드 디자인 이펙트를 직접 확인해 보고, 코드도 함께 확인해 보세요. 효과마다 이름과
        영문 검색어를 붙여 두었습니다. 이름을 알아야 검색할 수 있고, 검색할 수 있어야 말이 통합니다.
        데모는 전부 실제로 동작하니 마우스를 올려 보세요.
      </p>
    </header>

    <!-- 섹션 바로가기 -->
    <nav class="jump">
      <a v-for="s in SECTIONS" :key="s.id" :href="`#fx-${s.id}`">
        <span class="jump-num">{{ s.num }}</span> {{ s.title }}
      </a>
    </nav>

    <section v-for="s in SECTIONS" :id="`fx-${s.id}`" :key="s.id" class="fx-section">
      <div class="sec-head">
        <span class="sec-num">{{ s.num }}</span>
        <h2>{{ s.title }}</h2>
      </div>
      <p class="sec-desc">{{ s.desc }}</p>

      <div class="grid">
        <EffectCard
          v-for="fx in s.items"
          :key="fx.id"
          :title="fx.title"
          :term="fx.term"
          :note="fx.note"
          :code="fx.code"
        >
          <!-- 데모 판. 클래스는 effects.css가 받는다. -->
          <div class="fx fx-center" :class="`fx-${fx.id}`" v-html="fx.demo || ''"></div>
        </EffectCard>
      </div>
    </section>
  </div>
</template>

<!-- 데모 안쪽은 v-html이라 scoped가 닿지 않는다. 전역으로 둔다. -->
<style>
@import '@/assets/effects.css';
</style>

<style scoped>
.eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  color: var(--text-muted);
}

/* ---------------- 섹션 바로가기 ---------------- */
.jump {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 8px;
  border: 1px solid var(--border);
}

.jump a {
  padding: 10px 14px;
  border-right: 1px solid var(--border);
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: none;
}

.jump a:last-child {
  border-right: 0;
}

.jump a:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.jump-num {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--accent);
}

/* ---------------- 섹션 ---------------- */
.fx-section {
  /* 앵커로 점프했을 때 상단 고정 네비에 가리지 않도록 */
  scroll-margin-top: calc(var(--nav-height) + 16px);
  padding-top: 56px;
}

.sec-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 6px;
}

.sec-num {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  color: var(--accent);
}

.sec-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.sec-desc {
  max-width: 56ch;
  margin: 0 0 28px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 20px;
}
</style>
