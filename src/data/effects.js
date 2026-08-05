/**
 * 디자인 이펙트 카탈로그 데이터
 *
 * 항목마다 이름과 영문 검색어(term)를 같이 적어 두었다.
 * 이름을 알아야 검색할 수 있고, 검색할 수 있어야 디자이너에게 말이 통한다.
 *
 * demo: 데모 판 안쪽에 들어갈 마크업. 우리가 직접 쓴 고정 문자열이라 v-html로 넣는다.
 * code: 복사 버튼이 클립보드에 넣는 내용.
 */

export const SECTIONS = [
  {
    id: 'bg',
    num: '01',
    title: '배경 패턴',
    desc: '전부 이미지 없이 CSS만으로 만든다. 공통 규칙 하나 — 상하 대비를 10% 넘기지 말 것. 배경이 눈에 띄기 시작하면 이미 실패다.',
    items: [
      {
        id: 'dot',
        title: '도트 그리드',
        term: 'dot grid / polka pattern',
        note: '가장 무난하다. <code>background-size</code>로 간격을, 투명도로 세기를 조절한다.',
        code: `background-image: radial-gradient(
  circle, rgba(0,0,0,.22) 1px, transparent 1px);
background-size: 18px 18px;`,
      },
      {
        id: 'grid',
        title: '라인 그리드',
        term: 'grid lines / graph paper',
        note: '가로·세로 <code>linear-gradient</code> 두 장을 겹친다. 기술 제품 사이트의 기본값.',
        code: `background-image:
  linear-gradient(to right, rgba(0,0,0,.11) 1px, transparent 1px),
  linear-gradient(to bottom, rgba(0,0,0,.11) 1px, transparent 1px);
background-size: 36px 36px;`,
      },
      {
        id: 'mask',
        title: '마스크 페이드',
        term: 'mask-image fade',
        note: '이게 핵심이다. 패턴을 균일하게 깔면 답답한데, 한쪽만 남기고 사라지게 하면 완전히 달라진다.',
        code: `/* 그리드 위에 덧붙인다 */
mask-image: radial-gradient(
  ellipse 70% 60% at 50% 0%,
  #000 30%, transparent 100%);
-webkit-mask-image: /* 위와 동일 */;`,
      },
      {
        id: 'stripe',
        title: '대각선 스트라이프',
        term: 'diagonal stripes / hatching',
        note: '공사중·경고 영역이나 빈 상태 표시에 쓴다. 각도는 45도가 안전하다.',
        code: `background-image: repeating-linear-gradient(
  45deg,
  rgba(0,0,0,.11) 0 1px,
  transparent 1px 10px);`,
      },
      {
        id: 'scan',
        title: '스캔라인',
        term: 'scanlines / CRT effect',
        note: '레트로 터미널 감성. 얇은 가로줄을 4px 간격으로 반복한다.',
        code: `background-image: repeating-linear-gradient(
  to bottom,
  rgba(0,0,0,.11) 0 1px,
  transparent 1px 4px);`,
      },
      {
        id: 'grain',
        title: '필름 그레인',
        term: 'film grain / noise texture',
        note: '단색이 밋밋할 때 깊이를 준다. SVG 노이즈라 이미지 파일이 필요 없다. 실무에선 <code>opacity: .04</code> 정도.',
        code: `position: fixed; inset: 0;
pointer-events: none; z-index: 9999;
opacity: .04;
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");`,
      },
      {
        id: 'vignette',
        title: '비네트',
        term: 'vignette',
        note: '가장자리를 어둡게 눌러 시선을 가운데로 모은다. 사진·영상 위에 얹을 때 효과적이다.',
        code: `background: radial-gradient(
  ellipse at center,
  transparent 30%, #000 100%);`,
      },
      {
        id: 'conic',
        title: '코닉 그라디언트',
        term: 'conic-gradient',
        note: '각도로 도는 그라디언트. 회전시키면 로딩 스피너나 테두리 광원 효과가 된다.',
        code: `background: conic-gradient(
  from 180deg at 50% 50%,
  transparent 0deg, rgba(0,0,0,.11) 90deg,
  transparent 180deg, rgba(0,0,0,.11) 270deg,
  transparent 360deg);`,
      },
    ],
  },
  {
    id: 'surface',
    num: '02',
    title: '표면 · 테두리',
    desc: '그림자를 안 쓰기로 했다면, 면과 면을 구분할 다른 방법이 필요하다.',
    items: [
      {
        id: 'hair',
        title: '헤어라인 보더',
        term: 'hairline border',
        note: '가장 기본. 회색 대신 <b>흰색 투명도</b>를 쓰면 배경색이 바뀌어도 자연스럽게 따라온다.',
        demo: '<div class="box"></div>',
        code: `border: 1px solid rgba(255,255,255,.15);
/* ✗ border: 1px solid #333 */`,
      },
      {
        id: 'gborder',
        title: '그라디언트 보더',
        term: 'gradient border',
        note: '<code>border</code>에는 그라디언트를 못 넣는다. 뒤에 한 겹 깔고 1px 삐져나오게 하는 게 제일 간단하다.',
        demo: '<div class="box"></div>',
        code: `.box { position: relative; background: #fff; }
.box::before {
  content: ''; position: absolute; inset: -1px;
  background: linear-gradient(135deg, #000, transparent 65%);
  z-index: -1;
}`,
      },
      {
        id: 'bracket',
        title: '코너 브래킷',
        term: 'corner brackets / crop marks',
        note: '모서리만 그리는 방식. 전체 보더보다 가볍고, 조준경·터미널 느낌이 난다.',
        demo: '<div class="box"><i></i><i></i><i></i><i></i></div>',
        code: `i { position: absolute; width: 14px; height: 14px;
  border-color: currentColor; border-style: solid;
  border-width: 0; }
i:nth-child(1) { top: 0; left: 0;
  border-top-width: 1px; border-left-width: 1px; }
/* 나머지 3개도 같은 방식으로 */`,
      },
      {
        id: 'inset',
        title: '인셋 하이라이트',
        term: 'inset highlight / bevel',
        note: '안쪽에만 1px 밝은 선. 표면이 살짝 떠 보인다. 외부 그림자 없이 입체감을 주는 방법.',
        demo: '<div class="box"></div>',
        code: `box-shadow:
  inset 0 1px 0 rgba(255,255,255,.15),
  inset 0 0 0 1px rgba(255,255,255,.05);`,
      },
    ],
  },
  {
    id: 'text',
    num: '03',
    title: '텍스트',
    desc: '글자 자체에 거는 효과. 한 페이지에 하나만 쓴다.',
    items: [
      {
        id: 'clip',
        title: '그라디언트 텍스트',
        term: 'background-clip: text',
        note: '글자 모양으로 배경을 오려낸다. 남용하면 바로 AI 티가 난다. 제목 하나에만.',
        demo: '<b>Gradient</b>',
        code: `background: linear-gradient(100deg, #000 15%, #888 85%);
-webkit-background-clip: text;
background-clip: text;
color: transparent;`,
      },
      {
        id: 'outline',
        title: '아웃라인 텍스트',
        term: 'text-stroke / outlined type',
        note: '속을 비우고 윤곽선만. 거대한 배경 타이포에 자주 쓴다.',
        demo: '<b>Outline</b>',
        code: `color: transparent;
-webkit-text-stroke: 1px rgba(0,0,0,.35);`,
      },
      {
        id: 'glitch',
        title: '글리치',
        term: 'glitch text effect',
        note: '같은 글자를 세 겹 겹치고 순간 어긋나게 한다. 몇 초에 한 번만 터져야 거슬리지 않는다.',
        demo: '<span class="g" data-t="GLITCH">GLITCH</span>',
        code: `.g::before, .g::after {
  content: attr(data-t); position: absolute; inset: 0;
  background: var(--bg);
}
.g::before { animation: gl1 2.4s infinite steps(2); }

@keyframes gl1 {
  0%, 92%, 100% { clip-path: inset(0 0 100% 0) }
  94% { transform: translateX(-3px);
        clip-path: inset(10% 0 60% 0) }
}`,
      },
      {
        id: 'type',
        title: '타이핑 커서',
        term: 'typewriter effect',
        note: 'JS 없이 <code>width</code>를 <code>ch</code> 단위로 늘려서 만든다. 글자 수만큼 <code>steps()</code>를 맞춘다.',
        demo: '<span class="t">Hello, Skala</span>',
        code: `width: 14ch; overflow: hidden; white-space: nowrap;
border-right: 2px solid currentColor;
animation: tw 4s steps(14) infinite,
           caret .7s step-end infinite;

@keyframes tw { 0%,10% { width: 0 } 60%,100% { width: 14ch } }
@keyframes caret { 50% { border-color: transparent } }`,
      },
    ],
  },
  {
    id: 'interact',
    num: '04',
    title: '인터랙션',
    desc: '마우스를 올려 보자. 좋은 hover는 300ms 안팎에 cubic-bezier(.2,.8,.2,1)로 끝난다.',
    items: [
      {
        id: 'spot',
        title: '스포트라이트',
        term: 'mouse-follow spotlight',
        note: '커서 위치를 CSS 변수로 넘기고 <code>radial-gradient</code>가 따라오게 한다. 투명도 20% 이하로.',
        demo: '<div class="light"></div><small>마우스를 움직여 보세요</small>',
        code: `.light { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(160px circle at var(--mx) var(--my),
              rgba(0,0,0,.11), transparent 70%); }

el.addEventListener('mousemove', (e) => {
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', e.clientX - r.left + 'px')
  el.style.setProperty('--my', e.clientY - r.top + 'px')
})`,
      },
      {
        id: 'under',
        title: '언더라인 스윕',
        term: 'underline reveal',
        note: '들어올 땐 왼쪽에서, 나갈 땐 오른쪽으로. hover에서 <code>transform-origin</code>을 바꾸는 게 트릭이다.',
        demo: '<a href="#interact">밑줄이 쓸려 나갑니다</a>',
        code: `a::after { content: ''; position: absolute; left: 0; bottom: 0;
  width: 100%; height: 1px; background: currentColor;
  transform: scaleX(0); transform-origin: right;
  transition: transform .35s cubic-bezier(.2,.8,.2,1); }

a:hover::after { transform: scaleX(1); transform-origin: left; }`,
      },
      {
        id: 'lift',
        title: '리프트',
        term: 'hover lift',
        note: '그림자 대신 <code>translateY(-4px)</code>와 보더 색만 바꾼다. 4px 이상 올리면 과하다.',
        demo: '<div class="box">hover</div>',
        code: `transition: transform .3s cubic-bezier(.2,.8,.2,1),
            border-color .3s, color .3s;

&:hover { transform: translateY(-4px); border-color: currentColor; }`,
      },
      {
        id: 'fill',
        title: '필 스윕 버튼',
        term: 'fill sweep button',
        note: '배경색이 아래에서 차오른다. 색약 버튼 대신 쓰기 좋은 대안.',
        demo: '<button class="btn" type="button">Explore</button>',
        code: `.btn { position: relative; overflow: hidden; z-index: 0;
  border: 1px solid currentColor; background: none; }

.btn::before { content: ''; position: absolute; inset: 0;
  background: currentColor; transform: translateY(101%); z-index: -1;
  transition: transform .35s cubic-bezier(.2,.8,.2,1); }

.btn:hover::before { transform: translateY(0); }`,
      },
    ],
  },
  {
    id: 'motion',
    num: '05',
    title: '모션',
    desc: '모든 요소를 fade-in-up 시키는 게 AI 티의 큰 원인이다. 필요한 군데만 쓴다.',
    items: [
      {
        id: 'marquee',
        title: '마퀴 (무한 흐름)',
        term: 'infinite marquee / logo ticker',
        note: '파트너 로고 띠에 쓰는 그것. 목록을 <b>두 번</b> 넣고 -50% 이동시키면 이음새가 안 보인다.',
        demo: `<div class="track">
  <span>OpenAI</span><span>Meta</span><span>Samsung</span><span>NAVER</span><span>SK</span>
  <span>OpenAI</span><span>Meta</span><span>Samsung</span><span>NAVER</span><span>SK</span>
</div>`,
        code: `.track { display: flex; gap: 28px; width: max-content;
  animation: mq 12s linear infinite; }

@keyframes mq { to { transform: translateX(-50%) } }
/* HTML에서 목록을 정확히 2번 반복할 것 */`,
      },
      {
        id: 'reveal',
        title: '스크롤 리빌 + 스태거',
        term: 'scroll reveal / stagger',
        note: '<code>IntersectionObserver</code>로 화면에 들어올 때 클래스를 붙인다. 80ms씩 지연시키는 게 스태거.',
        demo: '<div class="rv">첫 번째 줄</div><div class="rv">두 번째 줄</div><div class="rv">세 번째 줄</div>',
        code: `const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return
    ;[...en.target.children].forEach((el, i) => {
      setTimeout(() => el.classList.add('on'), i * 80)
    })
    io.unobserve(en.target)
  })
}, { threshold: .3 })

io.observe(document.querySelector('.list'))`,
      },
      {
        id: 'count',
        title: '카운트업',
        term: 'count-up / odometer',
        note: '숫자가 올라가는 연출. <code>tabular-nums</code>를 안 주면 자릿수마다 폭이 흔들린다.',
        demo: '<span class="n">0</span>',
        code: `font-variant-numeric: tabular-nums;  /* 필수 */

let n = 0
const t = setInterval(() => {
  el.textContent = ++n
  if (n >= 28) clearInterval(t)
}, 40)`,
      },
      {
        id: 'pulse',
        title: '펄스 (라이브 표시)',
        term: 'pulse / ping indicator',
        note: '"실시간" 표시. 점 하나에 링이 퍼져나간다. 날씨 갱신 상태에 딱 어울린다.',
        demo: '<span class="dot"></span>',
        code: `.dot { width: 10px; height: 10px; border-radius: 50%;
  background: currentColor; position: relative; }

.dot::after { content: ''; position: absolute; inset: 0;
  border-radius: 50%; background: currentColor;
  animation: pl 1.8s ease-out infinite; }

@keyframes pl { to { transform: scale(3.6); opacity: 0 } }`,
      },
    ],
  },
]

/** 전체 이펙트 개수 */
export const TOTAL = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
