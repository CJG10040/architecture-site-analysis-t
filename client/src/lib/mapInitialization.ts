export type MapInitializationAction = "initialize" | "retry-container" | "stop" | "sdk-unavailable";

/** SDK 로드와 React DOM 커밋의 순서가 엇갈릴 때 지도 생성 시점을 결정한다. */
export function getMapInitializationAction(input: { isActive: boolean; hasContainer: boolean; hasMapsSdk: boolean }): MapInitializationAction {
  if (!input.isActive) return "stop";
  if (!input.hasMapsSdk) return "sdk-unavailable";
  return input.hasContainer ? "initialize" : "retry-container";
}
