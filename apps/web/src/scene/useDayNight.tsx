import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type DayNightMode = "day" | "night";

const STORAGE_KEY = "island.theme";

type DayNightContextValue = {
  mode: DayNightMode;
  isTransitioning: boolean;
  toggle: () => void;
  set: (mode: DayNightMode) => void;
};

const DayNightContext = createContext<DayNightContextValue | null>(null);

function readInitialMode(): DayNightMode {
  if (typeof window === "undefined") return "night";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "day" || stored === "night") return stored;
  } catch {
    // ignore storage errors
  }
  return "night";
}

type DayNightProviderProps = {
  children: ReactNode;
};

export function DayNightProvider({ children }: DayNightProviderProps) {
  const [mode, setMode] = useState<DayNightMode>(readInitialMode);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const set = useCallback((next: DayNightMode) => {
    setMode((current) => {
      if (current === next) return current;
      setIsTransitioning(true);
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = window.setTimeout(() => {
        setIsTransitioning(false);
        transitionTimerRef.current = null;
      }, 2400);
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    set(mode === "day" ? "night" : "day");
  }, [mode, set]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    },
    []
  );

  const value = useMemo<DayNightContextValue>(
    () => ({ mode, isTransitioning, toggle, set }),
    [mode, isTransitioning, toggle, set]
  );

  return <DayNightContext.Provider value={value}>{children}</DayNightContext.Provider>;
}

export function useDayNight(): DayNightContextValue {
  const value = useContext(DayNightContext);
  if (!value) {
    throw new Error("useDayNight must be used inside <DayNightProvider>");
  }
  return value;
}
