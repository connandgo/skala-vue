<script setup>
import { useRoute } from 'vue-router'

// Catch-all 라우트가 잡아낸 실제 경로를 보여준다
const route = useRoute()
</script>

<template>
  <div class="notfound">
    <p class="code">404</p>
    <h1 class="title">페이지를 찾을 수 없습니다</h1>
    <p class="path">{{ route.fullPath }}</p>
    <p class="desc">주소가 잘못되었거나 삭제된 페이지입니다.</p>

    <div class="actions">
      <RouterLink to="/" class="link-btn">대시보드로 돌아가기</RouterLink>
      <RouterLink to="/about" class="link-btn">서비스 소개</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.notfound {
  padding: 100px 0;
  text-align: center;
}

.code {
  font-family: var(--font-mono);
  font-size: 4.5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
}

.title {
  margin-top: 14px;
  font-size: 1.4rem;
  font-weight: 700;
}

.path {
  display: inline-block;
  margin-top: 12px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.desc {
  margin-top: 12px;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 28px;
}

.link-btn {
  display: inline-block;
  padding: 7px 13px;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  font-weight: 500;
}

.link-btn:hover {
  border-color: var(--hover-border);
  background: var(--bg-hover);
  color: var(--text);
}
</style>
