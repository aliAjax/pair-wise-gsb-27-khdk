// 拼车规则层：纯函数，不依赖存储与页面
import type {
  BatchFees,
  CarpoolOrder,
  CurrentBatchView,
  DepartedBatch,
  DepartedBatchView,
  OrderFee
} from "./types";

/** 体积重换算：每立方米 220 公斤 */
export const VOLUMETRIC_FACTOR = 220;

export interface RouteRule {
  name: string;
  baseRatePerKg: number; // 基础运费 元/kg（按计费重）
  minLoadKg: number; // 整车下限 kg，同线路同日累计达到才可拼车
  returnDiscountRate: number; // 返程空车折扣率（只减基础运费）
  handlingFeePerOrder: number; // 操作费 元/单（不参与折扣）
}

export const ROUTE_RULES: readonly RouteRule[] = [
  { name: "上海-南京", baseRatePerKg: 7, minLoadKg: 3000, returnDiscountRate: 0.12, handlingFeePerOrder: 80 },
  { name: "杭州-合肥", baseRatePerKg: 6.5, minLoadKg: 2600, returnDiscountRate: 0.1, handlingFeePerOrder: 70 },
  { name: "广州-深圳", baseRatePerKg: 5.5, minLoadKg: 2200, returnDiscountRate: 0.08, handlingFeePerOrder: 60 }
];

export function routeRule(route: string): RouteRule {
  return ROUTE_RULES.find((rule) => rule.name === route) ?? ROUTE_RULES[0];
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** 体积重 = 体积 × 220 kg/m³ */
export function volumetricWeight(volume: number): number {
  return round1(Math.max(0, volume) * VOLUMETRIC_FACTOR);
}

/** 计费重取实重与体积重的较大值 */
export function chargeableWeight(order: Pick<CarpoolOrder, "actualWeight" | "volume">): number {
  return round1(Math.max(order.actualWeight, volumetricWeight(order.volume)));
}

export function batchKey(route: string, departDate: string): string {
  return `${route}__${departDate}`;
}

/**
 * 单票费用。折扣率仅在批次达到整车下限且返程空车时非 0，
 * 且返程折扣只减基础运费，操作费不参与。
 */
export function orderFee(
  order: Pick<CarpoolOrder, "actualWeight" | "volume">,
  rule: RouteRule,
  discountRate: number
): OrderFee {
  const volumetric = volumetricWeight(order.volume);
  const chargeable = chargeableWeight(order);
  const baseFreight = round2(chargeable * rule.baseRatePerKg);
  const handlingFee = rule.handlingFeePerOrder;
  const discount = round2(baseFreight * discountRate);
  return {
    volumetricWeight: volumetric,
    chargeableWeight: chargeable,
    baseFreight,
    handlingFee,
    discount,
    total: round2(baseFreight + handlingFee - discount)
  };
}

function sumFees(fees: OrderFee[]): BatchFees {
  const base = round2(fees.reduce((acc, fee) => acc + fee.baseFreight, 0));
  const handling = round2(fees.reduce((acc, fee) => acc + fee.handlingFee, 0));
  const discount = round2(fees.reduce((acc, fee) => acc + fee.discount, 0));
  return { base, handling, discount, total: round2(base + handling - discount) };
}

/** 未成车（候选/可发车）批次评估：累计达整车下限才可拼车，否则保留候选并给出缺重 */
export function evaluateCurrentBatch(
  route: string,
  departDate: string,
  orders: CarpoolOrder[],
  returnEmpty: boolean
): CurrentBatchView {
  const rule = routeRule(route);
  const totalChargeable = round1(orders.reduce((acc, order) => acc + chargeableWeight(order), 0));
  const formed = totalChargeable >= rule.minLoadKg;
  // 未达到下限：不扣返程折扣，折扣率为 0
  const discountRate = formed && returnEmpty ? rule.returnDiscountRate : 0;
  const orderFees = Object.fromEntries(orders.map((order) => [order.id, orderFee(order, rule, discountRate)]));
  return {
    key: batchKey(route, departDate),
    route,
    departDate,
    status: formed ? "formed" : "candidate",
    orders,
    totalChargeable,
    minLoadKg: rule.minLoadKg,
    missingKg: formed ? 0 : round1(rule.minLoadKg - totalChargeable),
    returnEmpty,
    discountRate,
    orderFees,
    fees: sumFees(Object.values(orderFees))
  };
}

/** 已发车批次评估：重量与折扣在发车时锁定，仅重算展示 */
export function evaluateDepartedBatch(batch: DepartedBatch, orders: CarpoolOrder[]): DepartedBatchView {
  const rule = routeRule(batch.route);
  const discountRate = batch.returnEmpty ? rule.returnDiscountRate : 0;
  const orderFees = Object.fromEntries(orders.map((order) => [order.id, orderFee(order, rule, discountRate)]));
  return {
    id: batch.id,
    route: batch.route,
    departDate: batch.departDate,
    departedAt: batch.departedAt,
    returnEmpty: batch.returnEmpty,
    orders,
    totalChargeable: round1(orders.reduce((acc, order) => acc + chargeableWeight(order), 0)),
    discountRate,
    orderFees,
    fees: sumFees(Object.values(orderFees))
  };
}
