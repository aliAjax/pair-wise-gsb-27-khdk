// 拼车数据层：Pinia store + localStorage 持久化，刷新后候选/批次/折扣/费用一致
import { defineStore } from "pinia";
import type { CarpoolOrder, CurrentBatchView, DepartedBatch, DepartedBatchView } from "./types";
import { batchKey, evaluateCurrentBatch, evaluateDepartedBatch } from "./rules";

const STORAGE_KEY = "hxwlfront-13-carpool";

interface CarpoolState {
  orders: CarpoolOrder[];
  departedBatches: DepartedBatch[];
  returnEmptyByKey: Record<string, boolean>; // 未发车批次的返程空车标记
}

function today(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function seedState(): CarpoolState {
  const day = today();
  const departedOrders: CarpoolOrder[] = [
    { id: "seed-d1", route: "广州-深圳", departDate: today(-1), actualWeight: 1300, volume: 4, batchId: "seed-batch-1", cancelled: false, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: "seed-d2", route: "广州-深圳", departDate: today(-1), actualWeight: 900, volume: 3, batchId: "seed-batch-1", cancelled: false, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() }
  ];
  return {
    orders: [
      { id: "seed-1", route: "上海-南京", departDate: day, actualWeight: 1200, volume: 4, batchId: null, cancelled: false, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: "seed-2", route: "上海-南京", departDate: day, actualWeight: 900, volume: 8, batchId: null, cancelled: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: "seed-3", route: "上海-南京", departDate: day, actualWeight: 600, volume: 1, batchId: null, cancelled: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
      { id: "seed-4", route: "杭州-合肥", departDate: day, actualWeight: 800, volume: 2, batchId: null, cancelled: false, createdAt: new Date(Date.now() - 900000).toISOString() },
      { id: "seed-5", route: "杭州-合肥", departDate: day, actualWeight: 900, volume: 1.5, batchId: null, cancelled: false, createdAt: new Date(Date.now() - 600000).toISOString() },
      ...departedOrders
    ],
    departedBatches: [
      { id: "seed-batch-1", route: "广州-深圳", departDate: today(-1), returnEmpty: false, departedAt: new Date(Date.now() - 86400000).toISOString() }
    ],
    returnEmptyByKey: { [batchKey("上海-南京", day)]: true }
  };
}

function loadState(): CarpoolState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();
  try {
    const parsed = JSON.parse(raw) as CarpoolState;
    return {
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      departedBatches: Array.isArray(parsed.departedBatches) ? parsed.departedBatches : [],
      returnEmptyByKey: parsed.returnEmptyByKey ?? {}
    };
  } catch {
    return seedState();
  }
}

function saveState(state: CarpoolState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      orders: state.orders,
      departedBatches: state.departedBatches,
      returnEmptyByKey: state.returnEmptyByKey
    })
  );
}

export const useCarpoolStore = defineStore("carpool", {
  state: (): CarpoolState => loadState(),
  getters: {
    /** 有效订单（未取消） */
    activeOrders(state): CarpoolOrder[] {
      return state.orders.filter((order) => !order.cancelled);
    },
    /** 未发车批次：按线路 + 发车日聚合，达到整车下限为可发车，否则为候选 */
    currentBatches(): CurrentBatchView[] {
      const groups = new Map<string, CarpoolOrder[]>();
      for (const order of this.activeOrders) {
        if (order.batchId) continue;
        const key = batchKey(order.route, order.departDate);
        groups.set(key, [...(groups.get(key) ?? []), order]);
      }
      return [...groups.entries()]
        .map(([key, orders]) => {
          const [route, departDate] = [orders[0].route, orders[0].departDate];
          return evaluateCurrentBatch(route, departDate, orders, Boolean(this.returnEmptyByKey[key]));
        })
        .sort((a, b) => a.departDate.localeCompare(b.departDate) || a.route.localeCompare(b.route));
    },
    /** 已发车批次视图 */
    departedViews(state): DepartedBatchView[] {
      return state.departedBatches
        .map((batch) =>
          evaluateDepartedBatch(
            batch,
            state.orders.filter((order) => order.batchId === batch.id && !order.cancelled)
          )
        )
        .sort((a, b) => b.departedAt.localeCompare(a.departedAt));
    },
    metrics(): [number, number, number, number] {
      const candidates = this.currentBatches.filter((batch) => batch.status === "candidate").length;
      const formed = this.currentBatches.filter((batch) => batch.status === "formed").length;
      const departed = this.departedViews.length;
      const chargeable = Math.round(
        this.currentBatches.reduce((acc, batch) => acc + batch.totalChargeable, 0) +
          this.departedViews.reduce((acc, batch) => acc + batch.totalChargeable, 0)
      );
      return [candidates, formed, departed, chargeable];
    }
  },
  actions: {
    persist() {
      saveState(this.$state);
    },
    addOrder(input: { route: string; departDate: string; actualWeight: number; volume: number }) {
      this.orders.unshift({
        id: crypto.randomUUID(),
        route: input.route,
        departDate: input.departDate,
        actualWeight: input.actualWeight,
        volume: input.volume,
        batchId: null,
        cancelled: false,
        createdAt: new Date().toISOString()
      });
      this.persist();
    },
    /** 撤回订单：已发车批次不得撤回；撤回后若跌破整车下限，批次自动退回候选并撤销折扣 */
    cancelOrder(id: string) {
      const order = this.orders.find((item) => item.id === id);
      if (!order || order.batchId || order.cancelled) return;
      order.cancelled = true;
      this.persist();
    },
    toggleReturnEmpty(key: string) {
      this.returnEmptyByKey[key] = !this.returnEmptyByKey[key];
      this.persist();
    },
    /** 发车：仅达到整车下限的批次可发车；发车后订单锁定，返程空车标记随批次冻结 */
    depart(key: string) {
      const batch = this.currentBatches.find((item) => item.key === key);
      if (!batch || batch.status !== "formed") return;
      const departed: DepartedBatch = {
        id: crypto.randomUUID(),
        route: batch.route,
        departDate: batch.departDate,
        returnEmpty: batch.returnEmpty,
        departedAt: new Date().toISOString()
      };
      this.departedBatches.unshift(departed);
      for (const order of this.orders) {
        if (!order.cancelled && !order.batchId && batchKey(order.route, order.departDate) === key) {
          order.batchId = departed.id;
        }
      }
      delete this.returnEmptyByKey[key];
      this.persist();
    }
  }
});
