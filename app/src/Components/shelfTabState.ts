import { createContext, useContext } from "react";

export type ShelfTab = "shape" | "type" | "color";

export type ShelfTabContextValue = {
  selectedShelfTab: ShelfTab;
  setSelectedShelfTab: (tab: ShelfTab) => void;
};

export const ShelfTabContext = createContext<ShelfTabContextValue | null>(null);

export function useShelfTab() {
  const context = useContext(ShelfTabContext);
  if (!context) {
    throw new Error("useShelfTab must be used within ShelfTabProvider");
  }
  return context;
}
