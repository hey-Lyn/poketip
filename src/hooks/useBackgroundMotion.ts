import { useEffect } from "react";

const POINTER_STRENGTH = 6;
const IDLE_X = 1.4;
const IDLE_Y = 1;
const EASING = 0.004;

export function useBackgroundMotion(enabled) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const root = document.documentElement;
    const start = performance.now();
    let frame;
    let pointerX = 0;
    let pointerY = 0;
    let currentX = 0;
    let currentY = 0;

    function handlePointer(event) {
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
    }

    function tick(now) {
      currentX += (pointerX - currentX) * EASING;
      currentY += (pointerY - currentY) * EASING;

      const elapsed = now - start;
      const x = currentX * POINTER_STRENGTH * 2 + Math.sin(elapsed / 42000) * IDLE_X;
      const y = currentY * POINTER_STRENGTH * 2 + Math.cos(elapsed / 50000) * IDLE_Y;

      root.style.setProperty("--bg-x", `${x.toFixed(3)}%`);
      root.style.setProperty("--bg-y", `${y.toFixed(3)}%`);
      frame = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", handlePointer);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handlePointer);
      root.style.removeProperty("--bg-x");
      root.style.removeProperty("--bg-y");
    };
  }, [enabled]);
}
