import type { BatchStatus, BatchView, CarpoolOrder, RouteRule } from "../data/types";
import { findRouteRule } from "../data/routes";
import { quoteOrder } from "./fee";

export function batchKey(route: string, departDate: string): string {
  return `${route}__${departDate}`;
}

/** 同线路同日累计达到整车下限才可拼车；已发车批次保持锁定 */
export function resolveBatchStatus(
  totalChargeable: number,
  rule: RouteRule,
  departed: boolean
): BatchStatus {
  if (departed) return "已发车";
  return totalChargeable >= rule.truckMinWeight ? "已拼车" : "候选";
}

/**
 * 由订单聚合同线路同发车日的批次。
 * 未达整车下限时批次保留为候选且不扣返程折扣；
 * 取消订单使累计跌破下限时，状态自动退回候选、折扣随之撤销。
 */
export function buildBatches(
  orders: CarpoolOrder[],
  departedKeys: readonly string[],
  returnEmptyKeys: readonly string[]
): BatchView[] {
  const groups = new Map<string, CarpoolOrder[]>();
  for (const order of orders) {
    if (order.cancelled) continue;
    const key = batchKey(order.route, order.departDate);
    const list = groups.get(key) ?? [];
    list.push(order);
    groups.set(key, list);
  }

  const batches: BatchView[] = [];
  for (const [key, groupOrders] of groups) {
    const first = groupOrders[0];
    const rule = findRouteRule(first.route);
    if (!rule) continue;

    const departed = departedKeys.includes(key);
    const returnEmpty = returnEmptyKeys.includes(key);
    const totalChargeable = groupOrders.reduce(
      (acc, order) => acc + quoteOrder(order.actualWeight, order.volume, rule, 0).chargeableWeight,
      0
    );
    const status = resolveBatchStatus(totalChargeable, rule, departed);
    // 返程空车折扣仅在拼车成行后生效，且只减基础运费
    const discountRate = status !== "候选" && returnEmpty ? rule.returnDiscountRate : 0;

    const views = groupOrders.map((order) => ({
      ...order,
      quote: quoteOrder(order.actualWeight, order.volume, rule, discountRate)
    }));

    batches.push({
      key,
      route: rule.route,
      departDate: first.departDate,
      status,
      rule,
      orders: views,
      totalChargeable,
      missing: Math.max(0, rule.truckMinWeight - totalChargeable),
      returnEmpty,
      discountRate,
      baseTotal: views.reduce((acc, order) => acc + order.quote.baseFreight, 0),
      discountTotal: views.reduce((acc, order) => acc + order.quote.discount, 0),
      handlingTotal: views.reduce((acc, order) => acc + order.quote.handlingFee, 0),
      feeTotal: views.reduce((acc, order) => acc + order.quote.total, 0)
    });
  }

  return batches.sort(
    (a, b) => a.departDate.localeCompare(b.departDate) || a.route.localeCompare(b.route)
  );
}
