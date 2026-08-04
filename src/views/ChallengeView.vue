<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'

/**
 * 코드 챌린지 모음
 *
 * import.meta.glob 은 Vite 기능으로, 패턴에 맞는 파일들을 한꺼번에 찾아준다.
 * 38개를 일일이 import 하지 않아도 되고, 파일을 추가하면 자동으로 목록에 잡힌다.
 * (기본값 lazy 이므로 해당 챕터를 열 때만 실제로 내려받는다)
 */
const modules = import.meta.glob('../components/practices/**/*.vue')

// 챕터 정의 - 교안 순서대로
const CHAPTERS = [
  { id: 'basic', dir: 'basic', label: '2. Vue 문법', page: '~97' },
  { id: 'composition', dir: 'composition', label: '3. Composition API', page: '105~125' },
  { id: 'component', dir: 'component', label: '4. Vue Component', page: '136~157' },
  { id: 'library', dir: 'library', label: '6~7. Library', page: '190~' },
]

// 교안 진행 순서 (여기 없는 파일은 뒤쪽에 알파벳순으로 붙는다)
const ORDER = [
  // 2. Vue 문법
  'VueText', 'VueHtml', 'VueHtmlXss', 'VuePre', 'VueOnce', 'VueMemo', 'VueCloak',
  'VueBind', 'VueBindShorthand', 'VueBindClass', 'VueBindStyle',
  'VueIf', 'VueShow', 'VueFor',
  'EventBasic', 'EventObject', 'EventModifier',
  'ModelBasic', 'ModelForm', 'ModelModifier',
  'StyleScoped', 'SampleOne', 'SampleTwo',
  // 3. Composition API
  'ReactiveRef', 'ReactiveReactive',
  'ComputedBasic', 'WatchersBasic', 'WatchersMulti', 'WatchersDeep',
  'WatchersReactive', 'WatchersRefArray', 'WatchersReactiveArray', 'WatchersWatchEffect',
  // 4. Vue Component
  'LifecycleParent', 'PropsEmitsParent',
  'SlotDefaultParent', 'SlotNamedParent', 'SlotScopedParent',
  // 6~7. Library
  'StoreCounter', 'EcmaScript', 'ElementPlus', 'AxiosJson', 'AxiosWeather',
]

/** 파일 경로에서 컴포넌트 이름만 뽑는다 */
const nameOf = (path) => path.split('/').pop().replace('.vue', '')

/** 챕터별 컴포넌트 목록을 만든다 */
const buildChapter = (dir) =>
  Object.entries(modules)
    .filter(([path]) => path.includes(`/practices/${dir}/`))
    // Child 컴포넌트는 부모가 내부에서 쓰므로 목록에서 제외
    .filter(([path]) => !nameOf(path).endsWith('Child'))
    .map(([path, loader]) => ({
      name: nameOf(path),
      component: defineAsyncComponent(loader),
    }))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.name)
      const ib = ORDER.indexOf(b.name)
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })

const chapters = CHAPTERS.map((c) => ({ ...c, items: buildChapter(c.dir) }))

const activeId = ref('composition')
const current = computed(() => chapters.find((c) => c.id === activeId.value))
const total = chapters.reduce((sum, c) => sum + c.items.length, 0)
</script>

<template>
  <header class="page-banner">
    <p class="eyebrow">Code Challenge</p>
    <h1 class="page-title">코드 챌린지 모음</h1>
    <p class="page-desc">교안 실습 예제 {{ total }}개를 챕터별로 모아뒀습니다.</p>
  </header>

  <!-- 챕터 선택 -->
  <nav class="chapter-tabs">
    <button
      v-for="c in chapters"
      :key="c.id"
      class="chapter-tab"
      :class="{ active: activeId === c.id }"
      @click="activeId = c.id"
    >
      <span class="tab-label">{{ c.label }}</span>
      <span class="tab-count">{{ c.items.length }}</span>
    </button>
  </nav>

  <!-- Library 챕터에서만 보이는 안내 -->
  <div v-if="activeId === 'library'" class="notice">
    <p class="eyebrow">Vue Devtools</p>
    <p>
      Pinia 상태는 <kbd>F12</kbd> → <strong>Vue</strong> 탭 → <strong>Pinia</strong> 에서
      확인할 수 있습니다. 버튼을 누르면 값이 실시간으로 변하고, Devtools에서 값을 직접
      고치면 화면도 따라 바뀝니다.
    </p>
  </div>

  <!-- 선택한 챕터의 예제들 -->
  <div class="challenge-list">
    <section v-for="item in current.items" :key="item.name" class="challenge-item">
      <p class="item-name">{{ item.name }}.vue</p>
      <component :is="item.component" />
    </section>
  </div>
</template>

<style scoped>
.page-banner {
  padding: 40px 0 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 6px 0 0;
}

.page-desc {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* ---------------- 챕터 탭 ---------------- */
.chapter-tabs {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.chapter-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 -1px -1px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  background: transparent;
  font-size: 0.85rem;
}

.chapter-tab:hover {
  background: var(--bg-hover);
  border-color: var(--hover-border);
  z-index: 1;
}

.chapter-tab.active {
  background: var(--text);
  border-color: var(--text);
  color: var(--bg);
  z-index: 1;
}

.tab-count {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  opacity: 0.6;
}

/* ---------------- 안내 ---------------- */
.notice {
  padding: 14px 16px;
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-left: 2px solid var(--text);
  background: var(--bg-subtle);
}

.notice p:last-child {
  margin-top: 6px;
  font-size: 0.85rem;
}

/* ---------------- 예제 목록 ---------------- */
.challenge-item {
  margin-bottom: 8px;
}

.item-name {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 4px;
}

kbd {
  padding: 1px 5px;
  border: 1px solid var(--border);
  background: var(--bg-hover);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}
</style>
