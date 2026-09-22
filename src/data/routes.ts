import type { CarpoolOrder, RouteRule } from "./types";

/** 体积重换算：每立方米 220 公斤 */
export const VOLUME_WEIGHT_FACTOR = 220;

export const routeRules: readonly RouteRule[] = [
  { route: "上海-南京", basePricePerKg: 1.2, handlingFee: 80, truckMinWeight: 3000, returnDiscountRate: 0.12 },
  { route: "杭州-合肥", basePricePerKg: 1.5, handlingFee: 100, truckMinWeight: 2800, returnDiscountRate: 0.1 },
  { route: "广州-深圳", basePricePerKg: 0.9, handlingFee: 60, truckMinWeight: 2500, returnDiscountRate: 0.15 }
];

export function findRouteRule(route: string): RouteRule | undefined {
  return routeRules.find((item) => item.route === route);
}

export const seedOrders: CarpoolOrder[] = [
  {
    id: "seed-cp-1",
    route: "上海-南京",
    departDate: "2026-09-23",
    actualWeight: 1200,
    volume: 4,
    cancelled: false,
    createdAt: "2026-09-21T09:00:00.000Z"
  },
  {
    id: "seed-cp-2",
    route: "上海-南京",
    departDate: "2026-09-23",
    actualWeight: 900,
    volume: 3,
    cancelled: false,
    createdAt: "2026-09-21T10:00:00.000Z"
  },
  {
    id: "seed-cp-3",
    route: "上海-南京",
    departDate: "2026-09-23",
    actualWeight: 1500,
    volume: 2,
    cancelled: false,
    createdAt: "2026-09-22T08:00:00.000Z"
  },
  {
    id: "seed-cp-4",
    route: "杭州-合肥",
    departDate: "2026-09-23",
    actualWeight: 800,
    volume: 2,
    cancelled: false,
    createdAt: "2026-09-21T11:00:00.000Z"
  },
  {
    id: "seed-cp-5",
    route: "杭州-合肥",
    departDate: "2026-09-23",
    actualWeight: 500,
    volume: 1.5,
    cancelled: false,
    createdAt: "2026-09-22T09:30:00.000Z"
  },
  {
    id: "seed-cp-6",
    route: "广州-深圳",
    departDate: "2026-09-24",
    actualWeight: 1000,
    volume: 6,
    cancelled: false,
    createdAt: "2026-09-22T10:00:00.000Z"
  }
];
