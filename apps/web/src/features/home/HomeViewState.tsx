"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";

type Values = Record<string, unknown>;
const HomeViewContext = createContext<{
  values: Values;
  setValues: Dispatch<SetStateAction<Values>>;
} | null>(null);

export function HomeViewStateProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Values>({});
  return (
    <HomeViewContext.Provider value={{ values, setValues }}>
      {children}
    </HomeViewContext.Provider>
  );
}

export function useHomeViewState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(HomeViewContext);
  const [localValue, setLocalValue] = useState<T>(initialValue);
  if (!context) return [localValue, setLocalValue];
  const value = Object.hasOwn(context.values, key)
    ? (context.values[key] as T)
    : localValue;
  const setValue: Dispatch<SetStateAction<T>> = (update) => {
    context.setValues((previous) => {
      const previousValue = Object.hasOwn(previous, key)
        ? (previous[key] as T)
        : initialValue;
      return {
        ...previous,
        [key]:
          typeof update === "function"
            ? (update as (value: T) => T)(previousValue)
            : update,
      };
    });
  };
  return [value, setValue];
}
