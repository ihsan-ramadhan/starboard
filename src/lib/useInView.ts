import { useEffect, useRef, useState } from "react";

const ROOT_MARGIN = "300px";

export function useSeenInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (seen) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  return { ref, seen };
}
