import { createRouter, createWebHistory } from 'vue-router'

/**
 * 요구사항 1) 지연 로딩(Lazy Loading) + Catch-all Route
 *
 * - 모든 라우트를 `() => import(...)` 형태로 등록했다.
 *   해당 경로에 처음 들어갈 때 그 페이지 코드만 따로 내려받는다.
 *   (첫 화면에서 모든 페이지 코드를 한꺼번에 받지 않아도 된다)
 * - Catch-all은 반드시 배열의 "가장 마지막"에 둔다.
 *   위에서부터 순서대로 매칭하므로, 앞에 두면 모든 경로를 가로채 버린다.
 */
const routes = [
  {
    path: '/',
    name: 'WeatherHome',
    component: () => import('@/views/WeatherHomeView.vue'),
  },
  {
    path: '/about',
    name: 'WeatherAbout',
    component: () => import('@/views/WeatherAboutView.vue'),
  },
  {
    // :cityId 자리에 들어온 값을 페이지에서 route.params.cityId로 받는다
    path: '/weather/:cityId',
    name: 'WeatherDetail',
    component: () => import('@/views/WeatherDetailView.vue'),
  },
  {
    // 교안 코드 챌린지 모음 (Vue 문법 / Composition API / Component / Library)
    path: '/challenges',
    name: 'Challenges',
    component: () => import('@/views/ChallengeView.vue'),
  },
  {
    // 위 어디에도 걸리지 않은 모든 경로 (반드시 마지막)
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

const router = createRouter({
  // BASE_URL을 넘겨야 하위 경로로 배포(GitHub Pages 등)했을 때도 라우팅이 맞는다
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // 페이지를 이동하면 항상 맨 위에서 시작하도록
  scrollBehavior: () => ({ top: 0 }),
})

export default router
