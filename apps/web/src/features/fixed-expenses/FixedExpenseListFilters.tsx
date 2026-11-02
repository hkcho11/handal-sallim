"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

type ListFilters = {
  search: string;
  category: string;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  categoryScrollLeftRef: RefObject<number>;
};

const ListFiltersContext = createContext<ListFilters | null>(null);

export function FixedExpenseListFiltersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const categoryScrollLeftRef = useRef(0);

  return (
    <ListFiltersContext.Provider
      value={{
        search,
        category,
        setSearch,
        setCategory,
        categoryScrollLeftRef,
      }}
    >
      {children}
    </ListFiltersContext.Provider>
  );
}

export function useFixedExpenseListFilters() {
  const filters = useContext(ListFiltersContext);
  if (!filters) throw new Error("고정비 목록 필터 제공자가 필요합니다.");
  return filters;
}
