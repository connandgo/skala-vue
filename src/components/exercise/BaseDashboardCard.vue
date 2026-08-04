<template>
  <div class="base-dashboard-card">
    <slot></slot>
  </div>
</template>

<style scoped>
.base-dashboard-card {
  background: var(--bg-subtle);
  padding: 15px;
  border-radius: 0;
  margin-bottom: 15px;
  border: 1px solid var(--border);
}
</style>
