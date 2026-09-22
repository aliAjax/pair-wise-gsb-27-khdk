// 拼车批次台领域类型：订单、批次与费用视图

export interface CarpoolOrder {
  id: string;
  route: string;
  departDate: string; // YYYY-MM-DD 发车日
  actualWeight: number; // 实重 kg
  volume: number; // 体积 m³
  batchId: string | null; // 已发车批次 id，未发车为 null
  cancelled: boolean;
  createdAt: string;
}

export interface DepartedBatch {
  id: string;
  route: string;
  departDate: string;
  returnEmpty: boolean; // 发车时是否返程空车
  departedAt: string;
}

export interface OrderFee {
  volumetricWeight: number; // 体积重 kg
  chargeableWeight: number; // 计费重 kg（实重与体积重取大）
  baseFreight: number; // 基础运费
  handlingFee: number; // 操作费（不参与折扣）
  discount: number; // 返程折扣（只减基础运费）
  total: number;
}

export interface BatchFees {
  base: number;
  handling: number;
  discount: number;
  total: number;
}

export type CurrentBatchStatus = "candidate" | "formed";

export interface CurrentBatchView {
  key: string; // 线路 + 发车日
  route: string;
  departDate: string;
  status: CurrentBatchStatus; // candidate 候选 / formed 可发车
  orders: CarpoolOrder[];
  totalChargeable: number; // 累计计费重
  minLoadKg: number; // 整车下限
  missingKg: number; // 缺重（被挡时展示）
  returnEmpty: boolean;
  discountRate: number; // 生效折扣率（候选批次恒为 0）
  orderFees: Record<string, OrderFee>; // 按订单 id 的单票费用
  fees: BatchFees;
}

export interface DepartedBatchView {
  id: string;
  route: string;
  departDate: string;
  departedAt: string;
  returnEmpty: boolean;
  orders: CarpoolOrder[];
  totalChargeable: number;
  discountRate: number;
  orderFees: Record<string, OrderFee>;
  fees: BatchFees;
}
