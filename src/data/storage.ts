import type { CarpoolState } from "./types";
import { seedOrders } from "./routes";

export const STORAGE_KEY = "hxwlfront-13-carpool";

export function loadCarpoolState(): CarpoolState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { orders: seedOrders, departedBatchKeys: [], returnEmptyBatchKeys: [] };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CarpoolState>;
    return {
      orders: parsed.orders ?? [],
      departedBatchKeys: parsed.departedBatchKeys ?? [],
      returnEmptyBatchKeys: parsed.returnEmptyBatchKeys ?? []
    };
  } catch {
    return { orders: [], departedBatchKeys: [], returnEmptyBatchKeys: [] };
  }
}

export function saveCarpoolState(state: CarpoolState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
