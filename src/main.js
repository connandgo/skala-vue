/**
 * 앱 진입점.
 *
 * index.html 의 #app 자리에 Vue 앱을 붙인다.
 * 여기서 등록한 것만 모든 컴포넌트에서 쓸 수 있다.
 */

// CSS를 맨 위에서 불러야 컴포넌트가 들고 오는 스타일보다 먼저 깔린다.
// 순서가 뒤집히면 컴포넌트 쪽 규칙이 전역 규칙에 덮인다.
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

// Pinia를 라우터보다 먼저 등록한다.
// 라우터가 이동 중에 스토어를 읽을 수 있는데, 그때 스토어가 없으면 터진다.
app.use(createPinia())
app.use(router)

app.mount('#app')
