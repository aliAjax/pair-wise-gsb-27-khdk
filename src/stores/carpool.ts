import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { CarpoolOrder } from "../data/types";
import { loadCarpoolState, saveCarpoolState } from "../data/storage";
import { batchKey, buildBatches } from "../rules/batch";

export type ActionResult = { ok: boolean; reason?: string };

export const useCarpoolStore = defineStore("carpool", () => {
  const initial = loadCarpoolState();
  const orders = ref<CarpoolOrder[]>(initial.orders);
  const departedBatchKeys = ref<string[]>(initial.departedBatchKeys);
  const returnEmptyBatchKeys = ref<string[]>(initial.returnEmptyBatchKeys);

  // 候选、批次、折扣、费用全部由规则层派生，刷新后自然一致
  const batches = computed(() =>
    buildBatches(orders.value, departedBatchKeys.value, returnEmptyBatchKeys.value)
  );

  watch(
    [orders, departedBatchKeys, returnEmptyBatchKeys],
    () => {
      saveCarpoolState({
        orders: orders.value,
        departedBatchKeys: departedBatchKeys.value,
        returnEmptyBatchKeys: returnEmptyBatchKeys.value
      });
    },
    { deep: true }
  );

  function addOrder(input: {
    route: string;
    departDate: string;
    actualWeight: number;
    volume: number;
  }): void {
    orders.value = [
      {
        ...input,
        id: crypto.randomUUID(),
        cancelled: false,
        createdAt: new Date().toISOString()
      },
      ...orders.value
    ];
  }

  function cancelOrder(orderId: string): ActionResult {
    const order = orders.value.find((item) => item.id === orderId);
    if (!order || order.cancelled) return { ok: false, reason: "订单不存在" };
    const departed = departedBatchKeys.value.includes(batchKey(order.route, order.departDate));
    if (departed) return { ok: false, reason: "已发车批次不得撤回" };
    order.cancelled = true;
    return { ok: true };
  }

  function departBatch(key: string): ActionResult {
    const batch = batches.value.find((item) => item.key === key);
    if (!batch) return { ok: false, reason: "批次不存在" };
    if (batch.status === "已发车") return { ok: false, reason: "批次已发车" };
    if (batch.status === "候选") {
      return { ok: false, reason: `缺重 ${formatWeight(batch.missing)} kg，未达到整车下限` };
    }
    departedBatchKeys.value = [...departedBatchKeys.value, key];
    return { ok: true };
  }

  function setReturnEmpty(key: string, value: boolean): void {
    if (departedBatchKeys.value.includes(key)) return;
    returnEmptyBatchKeys.value = value
      ? [...new Set([...returnEmptyBatchKeys.value, key])]
      : returnEmptyBatchKeys.value.filter((item) => item !== key);
  }

  return { orders, batches, addOrder, cancelOrder, departBatch, setReturnEmpty };
});

function formatWeight(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}
