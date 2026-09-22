export type BatchStatus = "候选" | "已拼车" | "已发车";

export interface CarpoolOrder {
  id: string;
  route: string;
  departDate: string;
  actualWeight: number;
  volume: number;
  cancelled: boolean;
  createdAt: string;
}

export interface RouteRule {
  route: string;
  /** 基础运费单价 元/kg */
  basePricePerKg: number;
  /** 操作费 元/票，不参与返程折扣 */
  handlingFee: number;
  /** 整车下限 kg，同线路同日累计达到才可拼车 */
  truckMinWeight: number;
  /** 返程空车折扣率，只减基础运费 */
  returnDiscountRate: number;
}

export interface OrderQuote {
  volumetricWeight: number;
  chargeableWeight: number;
  baseFreight: number;
  discount: number;
  handlingFee: number;
  total: number;
}

export interface OrderView extends CarpoolOrder {
  quote: OrderQuote;
}

export interface BatchView {
  key: string;
  route: string;
  departDate: string;
  status: BatchStatus;
  rule: RouteRule;
  orders: OrderView[];
  totalChargeable: number;
  /** 距整车下限的缺重 kg */
  missing: number;
  returnEmpty: boolean;
  discountRate: number;
  baseTotal: number;
  discountTotal: number;
  handlingTotal: number;
  feeTotal: number;
}

export interface CarpoolState {
  orders: CarpoolOrder[];
  departedBatchKeys: string[];
  returnEmptyBatchKeys: string[];
}
