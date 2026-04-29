import { useMemo, useState, type ReactNode } from "react";
import { ShelfTabContext, type ShelfTab } from "./shelfTabState";

export function ShelfTabProvider({ children }: { children: ReactNode }) {
  const [selectedShelfTab, setSelectedShelfTab] = useState<ShelfTab>("shape");
  const value = useMemo(() => ({ selectedShelfTab, setSelectedShelfTab }), [selectedShelfTab]);
  return <ShelfTabContext.Provider value={value}>{children}</ShelfTabContext.Provider>;
}
