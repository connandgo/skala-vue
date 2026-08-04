<script setup>
// 1. 상위로 입력 텍스트를 전달할 커스텀 이벤트 등록 (매크로)
defineEmits(['update-query'])

// 2. 상위로부터 현재 검색 상태 값을 수신 (한글 동기화 상태 유지용)
defineProps({
  currentQuery: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="search-inner">
    <h3>🔍 도시 검색</h3>
    <input type="text" :value="currentQuery" @input="$emit('update-query', $event.target.value)" placeholder="검색할 도시 이름 입력" />
    <p>
      검색 중인 도시: <strong>{{ currentQuery }}</strong>
    </p>
  </div>
</template>

<style scoped>
/* 검색 영역 고유 디자인 (컴포넌트별 scoped 분리) */
.search-inner input {
  width: 100%;
  max-width: 320px;
}

.search-inner p {
  margin-top: 10px;
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
