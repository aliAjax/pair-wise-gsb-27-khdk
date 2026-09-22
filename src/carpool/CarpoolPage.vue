<script setup lang="ts">
// 拼车批次台页面：只负责展示与交互，规则来自 rules，数据来自 store
import { computed, reactive } from "vue";
import { useCarpoolStore } from "./store";
import { ROUTE_RULES, VOLUMETRIC_FACTOR, orderFee, routeRule } from "./rules";
import type { CurrentBatchView } from "./types";

const store = useCarpoolStore();

const metricLabels = ["候选批次", "可发车", "已发车", "累计计费重kg"];

const today = new Date().toISOString().slice(0, 10);
const form = reactive({
  route: ROUTE_RULES[0].name,
  departDate: today,
  actualWeight: 0,
  volume: 0
});

/** 表单实时试算：体积重 220kg/m³，计费重取实重与体积重较大值 */
const preview = computed(() => {
  const rule = routeRule(form.route);
  const fee = orderFee(
    { actualWeight: Number(form.actualWeight) || 0, volume: Number(form.volume) || 0 },
    rule,
    0
  );
  return { ...fee, rule, possibleDiscount: Math.round(fee.baseFreight * rule.returnDiscountRate * 100) / 100 };
});

const canSubmit = computed(
  () => Boolean(form.route && form.departDate) && (Number(form.actualWeight) > 0 || Number(form.volume) > 0)
);

function submit() {
  if (!canSubmit.value) return;
  store.addOrder({
    route: form.route,
    departDate: form.departDate,
    actualWeight: Number(form.actualWeight) || 0,
    volume: Number(form.volume) || 0
  });
  form.actualWeight = 0;
  form.volume = 0;
}

function tryDepart(batch: CurrentBatchView) {
  if (batch.status !== "formed") return; // 被挡：缺重不足，不可发车
  store.depart(batch.key);
}

const money = (value: number) => `¥${value.toFixed(2)}`;
const kg = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}`;
const percent = (batch: CurrentBatchView) => Math.min(100, Math.round((batch.totalChargeable / batch.minLoadKg) * 100));
</script>

<template>
  <section class="metrics carpool-metrics">
    <article v-for="(label, index) in metricLabels" :key="label" class="metric">
      <span>{{ label }}</span>
      <strong>{{ store.metrics[index] }}</strong>
    </article>
  </section>

  <section class="workspace">
    <form class="panel" @submit.prevent="submit">
      <h2>新增拼车单</h2>
      <div class="form-grid">
        <label>
          运输线路
          <select v-model="form.route" required>
            <option v-for="rule in ROUTE_RULES" :key="rule.name" :value="rule.name">{{ rule.name }}</option>
          </select>
        </label>
        <label>
          发车日
          <input v-model="form.departDate" type="date" required />
        </label>
        <label>
          实重 kg
          <input v-model="form.actualWeight" type="number" min="0" step="0.1" required />
        </label>
        <label>
          体积 m³
          <input v-model="form.volume" type="number" min="0" step="0.01" required />
        </label>

        <div class="preview">
          <p><span>体积重（{{ VOLUMETRIC_FACTOR }}kg/m³）</span><strong>{{ kg(preview.volumetricWeight) }} kg</strong></p>
          <p><span>计费重（取较大值）</span><strong>{{ kg(preview.chargeableWeight) }} kg</strong></p>
          <p><span>基础运费 + 操作费</span><strong>{{ money(preview.baseFreight) }} + {{ money(preview.handlingFee) }}</strong></p>
          <p><span>预估费用</span><strong>{{ money(preview.total) }}</strong></p>
          <p class="hint">
            同线路同日累计达 {{ kg(preview.rule.minLoadKg) }} kg 整车下限才可拼车；返程空车只减基础运费
            {{ Math.round(preview.rule.returnDiscountRate * 100) }}%（约 {{ money(preview.possibleDiscount) }}）。
          </p>
        </div>

        <button type="submit" :disabled="!canSubmit">加入拼车批次</button>
      </div>
    </form>

    <section class="list-panel">
      <div class="toolbar">
        <h2>拼车批次</h2>
        <span class="toolbar-note">同线路同发车日自动累计，达到整车下限才可拼车</span>
      </div>

      <div class="record-grid">
        <div v-if="store.currentBatches.length === 0" class="empty">暂无未发车批次，先新增拼车单</div>

        <article v-for="batch in store.currentBatches" :key="batch.key" class="record">
          <div class="record-head">
            <p class="record-title">{{ batch.route }} / {{ batch.departDate }}</p>
            <span class="status" :class="batch.status === 'formed' ? 'ok' : 'pending'">
              {{ batch.status === "formed" ? "可发车" : "候选" }}
            </span>
          </div>

          <div class="load-line">
            <div class="bar-track"><div class="bar-fill" :style="{ width: `${percent(batch)}%` }" /></div>
            <span>{{ kg(batch.totalChargeable) }} / {{ kg(batch.minLoadKg) }} kg</span>
          </div>
          <p v-if="batch.status === 'candidate'" class="missing">
            被挡：还差 {{ kg(batch.missingKg) }} kg 达到整车下限，批次保留为候选且不扣返程折扣
          </p>

          <div class="details">
            <span>基础运费: {{ money(batch.fees.base) }}</span>
            <span>操作费: {{ money(batch.fees.handling) }}</span>
            <span>返程折扣: -{{ money(batch.fees.discount) }}</span>
            <span>批次合计: {{ money(batch.fees.total) }}</span>
          </div>

          <label class="return-empty">
            <input type="checkbox" :checked="batch.returnEmpty" @change="store.toggleReturnEmpty(batch.key)" />
            返程空车（只减基础运费，未达下限不生效）
          </label>

          <table class="orders">
            <thead>
              <tr><th>实重kg</th><th>体积m³</th><th>体积重kg</th><th>计费重kg</th><th>费用</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="order in batch.orders" :key="order.id">
                <td>{{ kg(order.actualWeight) }}</td>
                <td>{{ order.volume }}</td>
                <td>{{ kg(batch.orderFees[order.id]?.volumetricWeight ?? 0) }}</td>
                <td>{{ kg(batch.orderFees[order.id]?.chargeableWeight ?? 0) }}</td>
                <td>{{ money(batch.orderFees[order.id]?.total ?? 0) }}</td>
                <td><button class="danger small" type="button" @click="store.cancelOrder(order.id)">撤回</button></td>
              </tr>
            </tbody>
          </table>

          <div class="actions">
            <button type="button" :disabled="batch.status !== 'formed'" @click="tryDepart(batch)">
              {{ batch.status === "formed" ? "确认发车" : `缺重 ${kg(batch.missingKg)} kg，不可发车` }}
            </button>
          </div>
        </article>
      </div>

      <template v-if="store.departedViews.length > 0">
        <div class="toolbar departed-head">
          <h2>已发车批次</h2>
          <span class="toolbar-note">已发车批次不得撤回</span>
        </div>
        <div class="record-grid">
          <article v-for="batch in store.departedViews" :key="batch.id" class="record departed">
            <div class="record-head">
              <p class="record-title">{{ batch.route }} / {{ batch.departDate }}</p>
              <span class="status locked">已发车</span>
            </div>
            <div class="details">
              <span>累计计费重: {{ kg(batch.totalChargeable) }} kg</span>
              <span>返程: {{ batch.returnEmpty ? "空车（只减基础运费）" : "满载（无折扣）" }}</span>
              <span>返程折扣: -{{ money(batch.fees.discount) }}</span>
              <span>批次合计: {{ money(batch.fees.total) }}</span>
            </div>
            <table class="orders">
              <thead>
                <tr><th>实重kg</th><th>体积m³</th><th>体积重kg</th><th>计费重kg</th><th>费用</th></tr>
              </thead>
              <tbody>
                <tr v-for="order in batch.orders" :key="order.id">
                  <td>{{ kg(order.actualWeight) }}</td>
                  <td>{{ order.volume }}</td>
                  <td>{{ kg(batch.orderFees[order.id]?.volumetricWeight ?? 0) }}</td>
                  <td>{{ kg(batch.orderFees[order.id]?.chargeableWeight ?? 0) }}</td>
                  <td>{{ money(batch.orderFees[order.id]?.total ?? 0) }}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      </template>
    </section>
  </section>
</template>

<style scoped>
.carpool-metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.toolbar-note {
  color: #69758c;
  font-size: 13px;
}
.preview {
  border: 1px dashed #cfd8e5;
  border-radius: 8px;
  padding: 10px 12px;
  display: grid;
  gap: 6px;
  background: #fbfcfe;
}
.preview p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #536078;
  font-size: 14px;
}
.preview .hint {
  display: block;
  color: #176b87;
  font-size: 12px;
  line-height: 1.6;
}
.status.ok { background: #e8f4ef; color: #14724f; }
.status.pending { background: #fdf1e3; color: #a05a12; }
.status.locked { background: #e8eef5; color: #445069; }
.load-line {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  margin: 12px 0 6px;
  color: #536078;
  font-size: 13px;
}
.missing {
  margin: 0 0 4px;
  color: #a05a12;
  background: #fdf1e3;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}
.return-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 12px;
  font-size: 13px;
}
.return-empty input {
  width: auto;
}
.orders {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 12px;
  font-size: 13px;
  color: #445069;
}
.orders th, .orders td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #e7edf4;
}
.orders th {
  color: #69758c;
  font-weight: 600;
}
button.small {
  padding: 6px 10px;
  font-size: 12px;
}
.departed {
  background: #f6f8fb;
}
.departed-head {
  margin-top: 20px;
}
@media (max-width: 860px) {
  .carpool-metrics {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
