<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import AuthDialog from '@/components/AuthDialog.vue'

/** 상단 네비의 계정 영역. 로그인 여부에 따라 보이는 것이 달라진다. */

const auth = useAuthStore()

// '' 이면 닫힘, 'login' / 'signup' 이면 그 탭으로 열림
const dialogMode = ref('')
</script>

<template>
  <div class="auth">
    <template v-if="auth.isLoggedIn">
      <span class="who" :title="`${auth.userId} 님으로 로그인됨`">{{ auth.userId }}</span>
      <button type="button" @click="auth.logOut">로그아웃</button>
    </template>

    <template v-else>
      <button type="button" @click="dialogMode = 'login'">로그인</button>
      <button class="primary" type="button" @click="dialogMode = 'signup'">회원가입</button>
    </template>
  </div>

  <AuthDialog v-if="dialogMode" :mode="dialogMode" @close="dialogMode = ''" />
</template>

<style scoped>
.auth {
  display: flex;
  align-items: center;
  gap: 6px;
}

.who {
  max-width: 8em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

button {
  margin: 0;
  padding: 4px 10px;
  font-size: 0.75rem;
}

.primary {
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
}

.primary:hover {
  background: var(--bg);
  color: var(--text);
}

@media (max-width: 620px) {
  .who {
    display: none;
  }
}
</style>
