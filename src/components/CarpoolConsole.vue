<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { routeRules, findRouteRule, VOLUME_WEIGHT_FACTOR } from "../data/routes";
import type { BatchStatus, BatchView } from "../data/types";
import { quoteOrder } from "../rules/fee";
import { useCarpoolStore } from "../stores/carpool";

const store = useCarpoolStore();

const today = new Date().toISOString().slice(0, 10);
const form = reactive({
  route: routeRules[0].route,
  departDate: today,
  actualWeight: 0,
  volume: 0
});

const notice = ref<{ type: "ok" | "error"; text: string } | null>(null);

const preview = computed(() => {
  const rule = findRouteRule(form.route);
  if (!rule) return null;
  return quoteOrder(form.actualWeight || 0, form.volume || 0, rule, 0);
});

const metrics = computed(() => {
  const list = store.batches;
  return [
    list.filter((batch) => batch.status === "候选").length,
    list.filter((batch) => batch.status === "已拼车").length,
    list.filter((batch) => batch.status === "已发车").length,
    list.reduce((acc, batch) => acc + batch.discountTotal, 0)
  ];
});

function submit() {
  if (form.actualWeight <= 0 || form.volume <= 0) {
    notice.value = { type: "error", text: "实重和体积均需大于 0" };
    return;
  }
  store.addOrder({ ...form });
  form.actualWeight = 0;
  form.volume = 0;
  notice.value = { type: "ok", text: "已加入拼车候选，同线路同发车日自动累计计费重" };
}

function depart(batch: BatchView) {
  const result = store.departBatch(batch.key);
  notice.value = result.ok
    ? { type: "ok", text: `${batch.route} ${batch.departDate} 已发车，批次锁定` }
    : { type: "error", text: `发车被挡：${result.reason}` };
}

function cancel(orderId: string) {
  const result = store.cancelOrder(orderId);
  notice.value = result.ok
    ? { type: "ok", text: "订单已取消，累计重量、批次状态与折扣已重算" }
    : { type: "error", text: `取消被挡：${result.reason}` };
}

function onReturnEmpty(batch: BatchView, event: Event) {
  store.setReturnEmpty(batch.key, (event.target as HTMLInputElement).checked);
}

function pillClass(status: BatchStatus) {
  if (status === "候选") return "candidate";
  if (status === "已拼车") return "formed";
  return "departed";
}

function percent(batch: BatchView) {
  return Math.min(100, Math.round((batch.totalChargeable / batch.rule.truckMinWeight) * 100));
}

const fmtMoney = (value: number) => value.toFixed(2);
const fmtWeight = (value: number) => (Math.round(value * 10) / 10).toString();
</script>

<template>
  <section class="console">
    <div class="console-head">
      <div>
        <h2>拼车批次台</h2>
        <p>
          体积重 = 体积 × {{ VOLUME_WEIGHT_FACTOR }} kg/m³，计费重取实重与体积重较大值。
          同线路同发车日累计达到整车下限才可拼车；不足时批次保留为候选，不扣返程折扣。
          返程空车折扣只减基础运费，已发车批次不得撤回。
        </p>
      </div>
    </div>

    <div class="console-metrics">
      <article class="console-metric"><span>候选批次</span><strong>{{ metrics[0] }}</strong></article>
      <article class="console-metric"><span>已拼车</span><strong>{{ metrics[1] }}</strong></article>
      <article class="console-metric"><span>已发车</span><strong>{{ metrics[2] }}</strong></article>
      <article class="console-metric"><span>返程折扣合计(元)</span><strong>{{ fmtMoney(metrics[3]) }}</strong></article>
    </div>

    <p v-if="notice" class="notice" :class="{ error: notice.type === 'error' }">{{ notice.text }}</p>

    <form class="console-form" @submit.prevent="submit">
      <label>
        线路
        <select v-model="form.route">
          <option v-for="rule in routeRules" :key="rule.route" :value="rule.route">{{ rule.route }}</option>
        </select>
      </label>
      <label>
        发车日
        <input v-model="form.departDate" type="date" required />
      </label>
      <label>
        实重(kg)
        <input v-model.number="form.actualWeight" type="number" min="0" step="1" required />
      </label>
      <label>
        体积(m³)
        <input v-model.number="form.volume" type="number" min="0" step="0.1" required />
      </label>
      <button type="submit">加入拼车候选</button>
    </form>
    <p v-if="preview" class="hint">
      体积重 {{ fmtWeight(preview.volumetricWeight) }} kg，计费重 {{ fmtWeight(preview.chargeableWeight) }} kg，
      预估费用 ¥{{ fmtMoney(preview.total) }}（含操作费 ¥{{ fmtMoney(preview.handlingFee) }}，未含返程折扣）
    </p>

    <div class="batch-grid">
      <div v-if="store.batches.length === 0" class="empty">暂无拼车批次，请先添加订单</div>
      <article v-for="batch in store.batches" :key="batch.key" class="batch-card">
        <div class="batch-head">
          <p class="batch-title">{{ batch.route }} / {{ batch.departDate }}</p>
          <span class="pill" :class="pillClass(batch.status)">{{ batch.status }}</span>
        </div>

        <div class="progress-row">
          <span>累计计费重 {{ fmtWeight(batch.totalChargeable) }} / {{ fmtWeight(batch.rule.truckMinWeight) }} kg</span>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${percent(batch)}%` }" />
          </div>
        </div>
        <p v-if="batch.status === '候选'" class="missing">
          被挡：距整车下限还缺 {{ fmtWeight(batch.missing) }} kg，批次保留为候选，返程折扣未生效
        </p>

        <div class="fee-lines">
          <div class="fee-line">基础运费<strong>¥{{ fmtMoney(batch.baseTotal) }}</strong></div>
          <div class="fee-line">返程折扣(仅减基础运费)<strong>-¥{{ fmtMoney(batch.discountTotal) }}</strong></div>
          <div class="fee-line">操作费<strong>¥{{ fmtMoney(batch.handlingTotal) }}</strong></div>
          <div class="fee-line">批次合计<strong>¥{{ fmtMoney(batch.feeTotal) }}</strong></div>
        </div>

        <div class="table-wrap">
          <table class="order-table">
            <thead>
              <tr>
                <th>实重kg</th><th>体积m³</th><th>体积重kg</th><th>计费重kg</th>
                <th>基础运费</th><th>折扣</th><th>费用</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in batch.orders" :key="order.id">
                <td>{{ fmtWeight(order.actualWeight) }}</td>
                <td>{{ order.volume }}</td>
                <td>{{ fmtWeight(order.quote.volumetricWeight) }}</td>
                <td>{{ fmtWeight(order.quote.chargeableWeight) }}</td>
                <td>¥{{ fmtMoney(order.quote.baseFreight) }}</td>
                <td>-¥{{ fmtMoney(order.quote.discount) }}</td>
                <td>¥{{ fmtMoney(order.quote.total) }}</td>
                <td>
                  <button
                    class="danger small"
                    type="button"
                    :disabled="batch.status === '已发车'"
                    :title="batch.status === '已发车' ? '已发车批次不得撤回' : '取消订单'"
                    @click="cancel(order.id)"
                  >取消</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="batch-actions">
          <label class="check-row">
            <input
              type="checkbox"
              :checked="batch.returnEmpty"
              :disabled="batch.status === '已发车'"
              @change="onReturnEmpty(batch, $event)"
            />
            返程空车（仅减基础运费 {{ Math.round(batch.rule.returnDiscountRate * 100) }}%）
          </label>
          <button v-if="batch.status !== '已发车'" type="button" @click="depart(batch)">
            {{ batch.status === "候选" ? `确认发车（缺重 ${fmtWeight(batch.missing)} kg）` : "确认发车" }}
          </button>
          <span v-else class="hint">已发车，批次锁定，订单不得撤回</span>
        </div>
      </article>
    </div>
  </section>
</template>
