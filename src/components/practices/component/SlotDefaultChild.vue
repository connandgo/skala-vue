<template>
  <div class="base-card">
    <slot>
      <p>기본 콘텐츠 영역입니다.</p>
    </slot>
  </div>
</template>

<style scoped>
.base-card {
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 15px;
  margin-bottom: 10px;
  background: var(--bg-subtle);
  
}
</style>
