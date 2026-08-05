<script setup>
import { computed, ref } from 'vue'
import { useConfigStore } from '@/stores/configStore'
import { toDisplayTemp } from '@/utils/temperature.js'
import { tempColor, readableInk } from '@/utils/tempScale.js'

/**
 * 전체 지역을 한 표로 본다.
 *
 * 카드를 세로로 쌓으면 17개를 훑는 데 스크롤이 길어지고 값끼리 비교가 안 된다.
 * 표는 열이 정렬되어 있어 "어디가 제일 덥나"를 눈으로 바로 찾을 수 있다.
 */

const props = defineProps({
  items: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
})

defineEmits(['select', 'detail'])

const configStore = useConfigStore()
const conv = (c) => toDisplayTemp(c, configStore.unit)

const isDark = ref(document.documentElement.classList.contains('theme-dark'))

const COLUMNS = [
  { key: 'name', label: '지역', align: 'left' },
  { key: 'temp', label: '기온', align: 'right' },
  { key: 'feelsLike', label: '체감', align: 'right' },
  { key: 'humidity', label: '습도', align: 'right' },
  { key: 'windSpeed', label: '바람', align: 'right' },
  { key: 'status', label: '상태', align: 'left' },
]

const sortKey = ref('temp')
const sortAsc = ref(false)

const toggleSort = (key) => {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    // 기온·습도 같은 숫자는 큰 값부터 보는 게 자연스럽다
    sortAsc.value = key === 'name' || key === 'status'
  }
}

const sorted = computed(() => {
  const key = sortKey.value
  // 원본 배열을 건드리면 부모의 목록 순서까지 바뀐다. 반드시 복사본을 정렬한다.
  return [...props.items].sort((a, b) => {
    const va = a[key]
    const vb = b[key]
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return sortAsc.value ? cmp : -cmp
  })
})
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th
            v-for="col in COLUMNS"
            :key="col.key"
            :class="[col.align, { active: sortKey === col.key }]"
            :aria-sort="sortKey === col.key ? (sortAsc ? 'ascending' : 'descending') : 'none'"
          >
            <button type="button" @click="toggleSort(col.key)">
              {{ col.label }}
              <span class="arrow">{{
                sortKey === col.key ? (sortAsc ? '↑' : '↓') : ''
              }}</span>
            </button>
          </th>
          <th class="right"></th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="item in sorted"
          :key="item.id"
          :class="{ on: item.id === selectedId }"
          @click="$emit('select', item)"
        >
          <td class="left name">
            <!-- 기온 색은 지도 마커와 같은 스케일을 쓴다 -->
            <span
              class="chip"
              :style="{ background: tempColor(item.temp, isDark), color: readableInk(tempColor(item.temp, isDark)) }"
              >{{ conv(item.temp) }}°</span
            >
            {{ item.name }}
          </td>
          <td class="right num">{{ conv(item.temp) }}°</td>
          <td class="right num">{{ conv(item.feelsLike) }}°</td>
          <td class="right num">{{ item.humidity }}%</td>
          <td class="right num">{{ item.windSpeed }}</td>
          <td class="left muted">{{ item.status }}</td>
          <td class="right">
            <button class="link" type="button" @click.stop="$emit('detail', item)">상세</button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="!items.length" class="empty">검색 결과와 일치하는 지역이 없습니다.</p>
  </div>
</template>

<style scoped>
.table-wrap {
  /* 좁은 화면에서 표만 가로로 스크롤되게 한다 (페이지가 밀리지 않도록) */
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

th {
  padding: 0;
  border-bottom: 1px solid var(--border-strong);
  font-weight: 500;
  white-space: nowrap;
}

th button {
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  background: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-align: inherit;
  cursor: pointer;
}

th button:hover {
  color: var(--text);
  background: var(--bg-hover);
}

th.active button {
  color: var(--text);
}

.arrow {
  font-size: 0.7rem;
}

td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover {
  background: var(--bg-hover);
}

/* 선택된 행은 색이 아니라 왼쪽 굵은 선으로 표시한다 */
tbody tr.on td:first-child {
  box-shadow: inset 3px 0 0 var(--text);
}

tbody tr.on {
  background: var(--bg-hover);
}

.left,
th.left button {
  text-align: left;
}

.right,
th.right button {
  text-align: right;
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.name {
  font-weight: 500;
}

.chip {
  display: inline-block;
  min-width: 40px;
  margin-right: 8px;
  padding: 1px 5px;
  border: 1px solid var(--text);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.muted {
  color: var(--text-muted);
}

.link {
  margin: 0;
  padding: 2px 8px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.link:hover {
  border-color: var(--hover-border);
  color: var(--text);
}

.empty {
  padding: 24px 0;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
}
</style>
