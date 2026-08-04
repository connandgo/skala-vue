import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
// command === 'build' 일 때만 하위 경로를 적용한다.
// (개발 중에도 base를 걸면 http://localhost:3000/skala-weather-demo/ 로만 열려서
//  /about 같은 경로가 404가 난다)
export default defineConfig(({ command }) => ({
  // GitHub Pages는 https://<계정>.github.io/<저장소>/ 하위 경로로 서비스되므로
  // 빌드 결과의 에셋 경로 앞에 저장소 이름을 붙인다.
  // 루트 도메인으로 배포(Vercel 등)할 때는 '/' 로 바꾸면 된다.
  base: command === 'build' ? '/skala-vue/' : '/',
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 🟢 [커스텀 추가 1] 로컬 개발 서버(Dev Server) 속성 제어
  server: {
    port: 3000, // 개발 서버의 네트워크 포트를 3000번으로 고정 명세
    open: true, // 프로세스 기동(npm run dev) 시 기본 웹 브라우저를 자동 실행
  },
  // 🟢 [커스텀 추가 2] 컴파일 완료된 산출물(Production Build) 사양 제어
  build: {
    outDir: 'dist', // 최종 정적 리소스(HTML, JS, CSS)가 저장될 출력 디렉토리명 지정
  },
}))
