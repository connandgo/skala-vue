<template>
  <div class="base-card">
    <header>
      <slot name="header"></slot>
    </header>
    <main>
      <slot></slot>
    </main>
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
