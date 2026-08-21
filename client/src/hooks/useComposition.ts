import { useRef } from "react";
import type * as React from "react";

type CompositionHandlers<T extends HTMLElement> = Pick<React.HTMLAttributes<T>, "onCompositionStart" | "onCompositionEnd" | "onKeyDown">;

/** CJK 조합 중 Enter가 확정 이벤트와 겹치지 않도록 입력 컴포넌트의 이벤트 순서를 보존한다. */
export function useComposition<T extends HTMLElement>(handlers: CompositionHandlers<T>) {
  const composing = useRef(false);
  return {
    onCompositionStart: (event: React.CompositionEvent<T>) => { composing.current = true; handlers.onCompositionStart?.(event); },
    onCompositionEnd: (event: React.CompositionEvent<T>) => { composing.current = false; handlers.onCompositionEnd?.(event); },
    onKeyDown: (event: React.KeyboardEvent<T>) => { if (!composing.current) handlers.onKeyDown?.(event); },
  };
}
