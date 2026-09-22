import { VOLUME_WEIGHT_FACTOR } from "../data/routes";

/** 体积重：每立方米 220 公斤 */
export function volumetricWeight(volume: number): number {
  return volume * VOLUME_WEIGHT_FACTOR;
}

/** 计费重：实重与体积重取较大值 */
export function chargeableWeight(actualWeight: number, volume: number): number {
  return Math.max(actualWeight, volumetricWeight(volume));
}
