<script setup>
import { CITIES } from '@/data/cities.js'
</script>

<template>
  <header class="page-banner">
    <p class="eyebrow">About</p>
    <h1 class="page-title">서비스 소개</h1>
  </header>

  <div class="dashboard-wrapper">
    <h3>무엇을 하는 서비스인가요</h3>
    <p class="para">
      전국 {{ CITIES.length }}개 지역의 실시간 날씨를 지도 위에 표시합니다. 
      지역을 선택하면 기온·강수량·습도·바람 등
      상세 정보와 3시간 단위 예보를 확인할 수 있습니다.
    </p>

    <h3>주요 기능</h3>
    <ul class="feature-list">
      <li><strong>실시간 조회</strong> — 10개 도시를 동시에 요청, 일부 실패해도 나머지는 정상 표시</li>
      <li><strong>지도 선택</strong> — 마커 색이 기온을 나타내며, 클릭하면 해당 지역 상세로 이동</li>
      <li><strong>평년 대비</strong> — 현재 기온이 그 달 평년보다 몇 도 높은지 표시</li>
      <li><strong>날씨 반응형 UI</strong> — 비·눈이 오는 지역을 고르면 화면에 그 효과가 나타남</li>
      <li><strong>다크 / 라이트 모드</strong> — 선택한 테마는 저장되어 다시 방문해도 유지됨</li>
    </ul>

    <h3>사용 기술</h3>
    <ul class="feature-list">
      <li>Vue 3 Composition API · Vue Router · axios</li>
      <li>Leaflet (지도) · Canvas (배경·날씨 효과)</li>
    </ul>

    <div class="actions">
      <RouterLink to="/weather" class="link-btn">날씨 대시보드 보기 →</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.page-banner {
  padding: 40px 0 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 28px;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 6px 0 0;
}

.dashboard-wrapper h3 {
  margin-top: 26px;
}

.dashboard-wrapper h3:first-child {
  margin-top: 0;
}

.para {
  font-size: 0.92rem;
  line-height: 1.75;
}

.feature-list {
  margin-top: 6px;
}

.feature-list li {
  padding: 8px 0 8px 14px;
  border-left: 2px solid var(--border);
  margin-bottom: 4px;
  font-size: 0.9rem;
}

.actions {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
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
