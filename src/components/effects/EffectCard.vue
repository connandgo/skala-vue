<script setup>
import { onUnmounted, ref } from 'vue'

/**
 * 이펙트 한 장.
 *
 *   위: 실제로 동작하는 데모
 *   아래: 이름 / 영문 검색어 / 설명 / 접히는 코드
 */

const props = defineProps({
  title: { type: String, required: true },
  term: { type: String, required: true },
  note: { type: String, default: '' },
  code: { type: String, required: true },
})

const copied = ref(false)
let timer = null

const copy = async () => {
  try {
    await navigator.clipboard.writeText(props.code)
  } catch {
    // http로 열었거나 권한이 없으면 clipboard API를 못 쓴다.
    // 화면 밖 textarea를 만들어 예전 방식으로 복사한다.
    const ta = document.createElement('textarea')
    ta.value = props.code
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 1400)
}

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <article class="card">
    <!-- 데모 판. 안쪽 마크업은 부모가 넣는다. -->
    <div class="demo">
      <slot />
    </div>

    <div class="meta">
      <h3>{{ title }}</h3>
      <p class="term">{{ term }}</p>
      <!-- 설명에 <code> 태그가 들어간다. 우리가 직접 쓴 고정 문자열이다. -->
      <p class="note" v-html="note"></p>

      <details>
        <summary>코드</summary>
        <pre>{{ code }}</pre>
        <button class="copy" :class="{ done: copied }" type="button" @click="copy">
          {{ copied ? 'copied' : 'copy' }}
        </button>
      </details>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  background: var(--bg);
}

.demo {
  position: relative;
  height: 170px;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}

.meta {
  padding: 14px 16px 4px;
}

.meta h3 {
  margin: 0 0 2px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.term {
  margin: 0 0 8px;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.note {
  margin: 0 0 12px;
  font-size: 0.8rem;
  line-height: 1.65;
  color: var(--text-muted);
}

.note :deep(code) {
  padding: 1px 4px;
  background: var(--bg-hover);
  font-family: var(--font-mono);
  font-size: 0.92em;
}

.note :deep(b) {
  color: var(--text);
  font-weight: 600;
}

details {
  border-top: 1px solid var(--border);
}

summary {
  padding: 8px 0;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  list-style: none;
  cursor: pointer;
  user-select: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary::before {
  content: '+ ';
}

details[open] summary::before {
  content: '− ';
}

summary:hover {
  color: var(--text);
}

pre {
  margin: 4px 0 0;
  padding: 12px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  line-height: 1.65;
  color: var(--text-meta);
  overflow-x: auto;
  white-space: pre;
}

.copy {
  margin: 8px 0 12px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.copy:hover {
  border-color: var(--hover-border);
  color: var(--text);
}

.copy.done {
  border-color: var(--text);
  color: var(--text);
}
</style>
