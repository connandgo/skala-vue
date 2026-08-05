<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore, passwordScore, SCORE_LABEL, ID_RULE, isTakenId } from '@/stores/authStore'

/**
 * 로그인 / 회원가입 창.
 * 탭 하나로 두 가지를 다 처리한다. 입력 칸이 거의 같아서 창을 나눌 이유가 없다.
 */

const props = defineProps({
  mode: { type: String, default: 'login' }, // 'login' | 'signup'
})
const emit = defineEmits(['close'])

const auth = useAuthStore()

const tab = ref(props.mode)
const id = ref('')
const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)
const error = ref('')
const busy = ref(false)

const dialogRef = ref(null)
const idInput = ref(null)

const isSignup = computed(() => tab.value === 'signup')
const score = computed(() => passwordScore(password.value))

const trimmedId = computed(() => id.value.trim().toLowerCase())

/**
 * 아이디 상태.
 * 서버가 아니라 이 브라우저의 저장소를 뒤지지만, 같은 아이디로 두 번 가입하는 것을
 * 막는다는 목적은 같다. 다른 기기의 가입은 알 수 없다.
 */
const idState = computed(() => {
  const v = trimmedId.value
  if (!v) return { kind: 'idle', text: '영문 소문자·숫자·밑줄 2~16자' }
  if (!ID_RULE.test(v)) return { kind: 'bad', text: '영문 소문자·숫자·밑줄 2~16자만 됩니다.' }
  if (isTakenId(v)) return { kind: 'bad', text: '이미 쓰고 있는 아이디입니다.' }
  return { kind: 'ok', text: '쓸 수 있는 아이디입니다.' }
})

/** 가입 조건 하나하나. 화면에 목록으로 보여 준다. */
const rules = computed(() => [
  { label: '8자 이상', pass: password.value.length >= 8 },
  { label: '숫자 포함', pass: /\d/.test(password.value) },
  { label: '영문 포함', pass: /[a-zA-Z]/.test(password.value) },
])

const matched = computed(
  () => passwordConfirm.value.length > 0 && password.value === passwordConfirm.value,
)

/** 가입 버튼을 누를 수 있는 상태인가 */
const canSignUp = computed(
  () => idState.value.kind === 'ok' && rules.value.every((r) => r.pass) && matched.value,
)

// 탭을 바꾸면 에러와 비밀번호는 지운다 (아이디는 다시 치기 번거로우니 남긴다)
watch(tab, () => {
  error.value = ''
  password.value = ''
  passwordConfirm.value = ''
})

const submit = async () => {
  error.value = ''

  const trimmed = trimmedId.value
  if (isSignup.value) {
    // 화면에 이미 하나하나 표시하고 있으니, 여기서는 마지막 방어선만 둔다
    if (!canSignUp.value) {
      error.value = '입력 조건을 모두 채워 주세요.'
      return
    }
  } else {
    if (!trimmed) {
      error.value = '아이디를 입력해 주세요.'
      return
    }
    if (!password.value) {
      error.value = '비밀번호를 입력해 주세요.'
      return
    }
  }

  busy.value = true
  try {
    if (isSignup.value) await auth.signUp(trimmed, password.value)
    else await auth.logIn(trimmed, password.value)
    emit('close')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

/**
 * 키보드 처리.
 *   Esc  - 닫는다
 *   Tab  - 창 안에서만 돌게 가둔다. 안 그러면 뒤쪽 페이지로 포커스가 빠져나가
 *          지금 어디를 조작하는지 알 수 없게 된다.
 */
const onKey = (e) => {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !dialogRef.value) return

  const focusable = dialogRef.value.querySelectorAll('button, input, [href]')
  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

let scrollLocked = ''

onMounted(async () => {
  window.addEventListener('keydown', onKey)

  // 창이 떠 있는 동안 뒤쪽이 스크롤되면 창이 화면 밖으로 밀려 보인다
  scrollLocked = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  await nextTick()
  idInput.value?.focus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = scrollLocked
})
</script>

<template>
  <!-- 바깥을 누르면 닫힌다. 안쪽 클릭은 @click.stop 이 막는다. -->
  <div class="backdrop" @click="$emit('close')">
    <div
      ref="dialogRef"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-label="계정"
      @click.stop
    >
      <div class="tabs">
        <button :class="{ on: tab === 'login' }" type="button" @click="tab = 'login'">로그인</button>
        <button :class="{ on: isSignup }" type="button" @click="tab = 'signup'">회원가입</button>
        <button class="x" type="button" aria-label="닫기" @click="$emit('close')">×</button>
      </div>

      <form @submit.prevent="submit">
        <label>
          <span>아이디</span>
          <input
            ref="idInput"
            v-model="id"
            type="text"
            autocomplete="username"
            :class="isSignup && idState.kind === 'bad' ? 'bad' : ''"
          />
        </label>
        <p v-if="isSignup" class="check" :class="idState.kind">
          <span class="mark">{{ idState.kind === 'ok' ? '✓' : idState.kind === 'bad' ? '✕' : '·' }}</span>
          {{ idState.text }}
        </p>

        <label>
          <span>비밀번호</span>
          <div class="pw">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isSignup ? 'new-password' : 'current-password'"
            />
            <button
              type="button"
              class="peek"
              :aria-label="showPassword ? '비밀번호 숨기기' : '비밀번호 보기'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '숨기기' : '보기' }}
            </button>
          </div>
        </label>

        <!-- 가입할 때만 강도를 알려 준다. 로그인할 때는 참견할 일이 아니다. -->
        <template v-if="isSignup">
          <div v-if="password" class="strength">
            <div class="bars">
              <span v-for="i in 4" :key="i" :class="{ on: i <= score }"></span>
            </div>
            <span class="strength-label">{{ SCORE_LABEL[score] }}</span>
          </div>

          <ul class="rules">
            <li v-for="r in rules" :key="r.label" :class="{ pass: r.pass }">
              <span class="mark">{{ r.pass ? '✓' : '·' }}</span> {{ r.label }}
            </li>
          </ul>
        </template>

        <label v-if="isSignup">
          <span>비밀번호 확인</span>
          <input
            v-model="passwordConfirm"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :class="passwordConfirm && !matched ? 'bad' : ''"
          />
        </label>
        <p v-if="isSignup && passwordConfirm" class="check" :class="matched ? 'ok' : 'bad'">
          <span class="mark">{{ matched ? '✓' : '✕' }}</span>
          {{ matched ? '비밀번호가 같습니다.' : '비밀번호가 서로 다릅니다.' }}
        </p>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="submit" type="submit" :disabled="busy || (isSignup && !canSignUp)">
          {{ busy ? '처리 중…' : isSignup ? '가입하기' : '로그인' }}
        </button>
      </form>

      <p class="disclaimer">
        서버가 없는 데모입니다. 계정은 <b>이 브라우저에만</b> 저장되며 어디로도 전송되지 않습니다.
        중복 확인도 이 브라우저에 저장된 계정만 봅니다. 로그인하면 즐겨찾는 지역과 화면 설정이
        계정에 남습니다.
      </p>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

.dialog {
  width: 100%;
  max-width: 340px;
  border: 1px solid var(--border-strong);
  background: var(--bg);
}

/* ---------------- 탭 ---------------- */
.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}

.tabs button {
  flex: 1;
  margin: 0;
  padding: 11px 0;
  border: 0;
  border-right: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.tabs button:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.tabs button.on {
  background: var(--text);
  color: var(--bg);
}

.tabs .x {
  flex: 0 0 44px;
  border-right: 0;
  font-size: 1.1rem;
  line-height: 1;
}

/* ---------------- 폼 ---------------- */
form {
  padding: 20px;
}

label {
  display: block;
  margin-bottom: 14px;
}

label span {
  display: block;
  margin-bottom: 5px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

label input {
  width: 100%;
  margin: 0;
}

.pw {
  display: flex;
}

.pw input {
  flex: 1;
  min-width: 0;
}

.peek {
  flex: 0 0 auto;
  margin: 0 0 0 -1px;
  padding: 0 10px;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.peek:hover {
  color: var(--text);
}

/* ---------------- 비밀번호 강도 ---------------- */
.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -6px 0 14px;
}

.bars {
  display: flex;
  gap: 3px;
}

.bars span {
  width: 26px;
  height: 4px;
  border: 1px solid var(--border);
}

.bars span.on {
  border-color: var(--text);
  background: var(--text);
}

.strength-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

/* ---------------- 실시간 검증 표시 ---------------- */
.check {
  margin: -10px 0 14px;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.check.ok {
  color: var(--text);
}

.check.bad {
  color: var(--text);
  font-weight: 500;
}

.mark {
  display: inline-block;
  width: 1em;
  font-family: var(--font-mono);
}

.rules {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: -6px 0 14px;
  padding: 0;
  list-style: none;
}

.rules li {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.rules li.pass {
  color: var(--text);
}

input.bad {
  border-color: var(--text);
}

.error {
  margin: 0 0 14px;
  padding: 8px 10px;
  border-left: 2px solid var(--text);
  background: var(--bg-subtle);
  font-size: 0.78rem;
}

.submit {
  width: 100%;
  margin: 0;
  padding: 9px;
  border-color: var(--text);
  background: var(--text);
  color: var(--bg);
  font-size: 0.85rem;
}

.submit:hover:not(:disabled) {
  background: var(--bg);
  color: var(--text);
}

.submit:disabled {
  border-color: var(--border);
  background: var(--border);
  color: var(--bg);
}

.disclaimer {
  padding: 0 20px 18px;
  font-size: 0.7rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.disclaimer b {
  color: var(--text);
  font-weight: 600;
}
</style>
