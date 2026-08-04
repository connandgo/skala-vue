/**
 * 기온 단위 변환
 *
 * API에서 받는 원본 데이터는 항상 섭씨(units=metric)다.
 * 화면에 뿌릴 때만 현재 설정에 맞춰 변환한다. (원본은 건드리지 않는다)
 *
 * ※ 교안에서는 각 컴포넌트마다 동일한 computed를 두는 방식으로 안내하지만,
 *   같은 수식이 여러 곳에 복사되므로 변환식만 여기로 모았다.
 *   (교안 참고사항의 "Composable로 해결 가능"과 같은 취지)
 */
export const toDisplayTemp = (celsius, unit) => {
  if (celsius == null) return null
  return unit === 'fahrenheit'
    ? Math.round((celsius * 9) / 5 + 32) // 화씨 변환
    : Math.round(celsius) // 섭씨는 원본 그대로
}
