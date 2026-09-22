import type { OrderQuote, RouteRule } from "../data/types";
import { chargeableWeight, volumetricWeight } from "./weight";

/**
 * 单票费用试算。
 * 返程折扣只减基础运费，操作费不参与折扣。
 */
export function quoteOrder(
  actualWeight: number,
  volume: number,
  rule: RouteRule,
  discountRate: number
): OrderQuote {
  const volumetric = volumetricWeight(volume);
  const chargeable = chargeableWeight(actualWeight, volume);
  const baseFreight = chargeable * rule.basePricePerKg;
  const discount = baseFreight * discountRate;
  return {
    volumetricWeight: volumetric,
    chargeableWeight: chargeable,
    baseFreight,
    discount,
    handlingFee: rule.handlingFee,
    total: baseFreight - discount + rule.handlingFee
  };
}
