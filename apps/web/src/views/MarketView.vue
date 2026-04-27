<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  QUALITY_COLOR,
  QUALITY_LABEL_VI,
  type ItemKind,
} from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import {
  buyListing,
  cancelListing,
  listMarket,
  listMine,
  postListing,
  type ListingView,
} from '@/api/market';
import { listInventory, type InventoryView } from '@/api/inventory';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();

const tab = ref<'buy' | 'sell'>('buy');
const submitting = ref(false);

const buyListings = ref<ListingView[]>([]);
const myListings = ref<ListingView[]>([]);
const inventory = ref<InventoryView[]>([]);
const feePct = ref(0.05);
const filterKind = ref<ItemKind | ''>('');

const KIND_LABELS: Record<ItemKind, string> = {
  WEAPON: 'Vũ Khí',
  ARMOR: 'Áo / Giáp',
  PILL_HP: 'Đan HP',
  PILL_MP: 'Đan MP',
  PILL_EXP: 'Đan EXP',
  ORE: 'Quặng',
  MISC: 'Khác',
};

// Form đăng bán
const sellInvId = ref<string>('');
const sellQty = ref<number>(1);
const sellPrice = ref<string>('100');

const selectedInv = computed(() =>
  inventory.value.find((i) => i.id === sellInvId.value) ?? null,
);

const sellableInventory = computed(() =>
  inventory.value.filter((i) => !i.equippedSlot && i.qty > 0),
);

const totalSell = computed(() => {
  if (!selectedInv.value) return '0';
  try {
    const p = BigInt(sellPrice.value || '0');
    return (p * BigInt(sellQty.value || 0)).toString();
  } catch {
    return '0';
  }
});

const feeNote = computed(() => {
  if (totalSell.value === '0') return '';
  try {
    const t = BigInt(totalSell.value);
    const f = (t * BigInt(Math.round(feePct.value * 1000))) / 1000n;
    return `Phí thiên đạo: ${f.toString()} · Nhận: ${(t - f).toString()}`;
  } catch {
    return '';
  }
});

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
  await refreshAll();
});

async function refreshAll(): Promise<void> {
  try {
    const [m, mine, inv] = await Promise.all([
      listMarket(filterKind.value || undefined),
      listMine(),
      listInventory(),
    ]);
    buyListings.value = m.listings;
    feePct.value = m.feePct;
    myListings.value = mine;
    inventory.value = inv;
  } catch (e) {
    handleErr(e);
  }
}

async function onBuy(l: ListingView): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await buyListing(l.id);
    toast.push({
      type: 'success',
      text: `Đã mua ${l.item.name} ×${l.qty} với giá ${l.totalPrice} linh thạch.`,
    });
    await refreshAll();
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onCancel(l: ListingView): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await cancelListing(l.id);
    toast.push({ type: 'system', text: 'Đã thu hồi tin đăng — vật phẩm đã trả về túi.' });
    await refreshAll();
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onPost(): Promise<void> {
  if (!selectedInv.value || submitting.value) return;
  submitting.value = true;
  try {
    await postListing(sellInvId.value, sellQty.value, sellPrice.value);
    toast.push({ type: 'success', text: 'Đăng bán thành công.' });
    sellInvId.value = '';
    sellQty.value = 1;
    sellPrice.value = '100';
    await refreshAll();
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

function handleErr(e: unknown): void {
  const code = (e as { code?: string })?.code ?? 'UNKNOWN';
  const map: Record<string, string> = {
    INSUFFICIENT_LINH_THACH: 'Không đủ linh thạch.',
    LISTING_INACTIVE: 'Tin đăng đã được mua hoặc gỡ.',
    CANNOT_BUY_OWN: 'Không thể mua hàng của chính mình.',
    INVALID_QTY: 'Số lượng không hợp lệ.',
    INVALID_PRICE: 'Giá không hợp lệ.',
    ITEM_EQUIPPED: 'Hãy tháo trang bị trước khi đăng bán.',
    INVENTORY_ITEM_NOT_FOUND: 'Vật phẩm không còn nữa.',
    LISTING_NOT_FOUND: 'Tin đăng không tồn tại.',
    NOT_OWNER: 'Đây không phải tin đăng của bạn.',
    UNKNOWN: 'Có lỗi xảy ra, mời thử lại.',
  };
  toast.push({ type: 'error', text: map[code] ?? map.UNKNOWN });
}
</script>

<template>
  <AppShell>
    <h2 class="text-xl tracking-widest mb-4">Phường Thị</h2>

    <div class="flex gap-2 mb-4">
      <MButton :class="tab === 'buy' ? '!bg-ink-50 !text-ink-900' : ''" @click="tab = 'buy'">
        Mua Hàng
      </MButton>
      <MButton :class="tab === 'sell' ? '!bg-ink-50 !text-ink-900' : ''" @click="tab = 'sell'">
        Bán Của Tôi
      </MButton>
      <span class="ml-auto text-xs text-ink-300 self-center">
        Phí thiên đạo: {{ Math.round(feePct * 100) }}%
      </span>
    </div>

    <!-- Tab Mua -->
    <section v-if="tab === 'buy'" class="space-y-3">
      <div class="flex items-center gap-2 text-sm">
        <label class="text-ink-300">Lọc loại:</label>
        <select
          v-model="filterKind"
          class="bg-ink-700 border border-ink-300/40 rounded px-2 py-1 text-sm"
          @change="refreshAll"
        >
          <option value="">Tất cả</option>
          <option v-for="k in (Object.keys(KIND_LABELS) as ItemKind[])" :key="k" :value="k">
            {{ KIND_LABELS[k] }}
          </option>
        </select>
      </div>

      <div v-if="buyListings.length === 0" class="text-ink-300 italic">
        Chưa có tin đăng nào.
      </div>
      <div
        v-for="l in buyListings"
        :key="l.id"
        class="rounded border border-ink-300/40 bg-ink-700/30 p-3 flex items-center gap-3"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-bold" :class="QUALITY_COLOR[l.item.quality]">
              {{ l.item.name }}
            </span>
            <span class="text-[10px] text-ink-300">
              {{ QUALITY_LABEL_VI[l.item.quality] }} · ×{{ l.qty }}
            </span>
          </div>
          <p class="text-xs text-ink-300">{{ l.item.description }}</p>
          <p class="text-xs">
            Đạo hữu <span class="text-amber-200">{{ l.sellerName }}</span> đăng
          </p>
        </div>
        <div class="text-right">
          <div class="text-amber-300 font-bold text-sm">
            {{ l.totalPrice }} <span class="text-[10px]">⛀</span>
          </div>
          <div class="text-[10px] text-ink-300">{{ l.pricePerUnit }} / chiếc</div>
          <MButton
            v-if="!l.isMine"
            class="mt-1 !px-2 !py-0.5 text-xs"
            :loading="submitting"
            @click="onBuy(l)"
          >
            Mua
          </MButton>
          <span v-else class="text-[10px] text-ink-300/60 italic">tin của bạn</span>
        </div>
      </div>
    </section>

    <!-- Tab Bán -->
    <section v-if="tab === 'sell'" class="space-y-4">
      <!-- Form đăng bán -->
      <div class="rounded border border-ink-300/40 bg-ink-700/30 p-4 space-y-3">
        <h3 class="text-base font-bold">Đăng bán mới</h3>
        <div class="grid sm:grid-cols-3 gap-3">
          <label class="text-sm">
            <span class="block text-ink-300 mb-1">Vật phẩm</span>
            <select
              v-model="sellInvId"
              class="bg-ink-700 border border-ink-300/40 rounded px-2 py-1 w-full"
            >
              <option value="">— chọn —</option>
              <option v-for="i in sellableInventory" :key="i.id" :value="i.id">
                {{ i.item.name }} (×{{ i.qty }})
              </option>
            </select>
          </label>
          <label class="text-sm">
            <span class="block text-ink-300 mb-1">Số lượng</span>
            <input
              v-model.number="sellQty"
              type="number"
              min="1"
              :max="selectedInv?.qty ?? 1"
              class="bg-ink-700 border border-ink-300/40 rounded px-2 py-1 w-full"
            />
          </label>
          <label class="text-sm">
            <span class="block text-ink-300 mb-1">Giá / chiếc (linh thạch)</span>
            <input
              v-model="sellPrice"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              class="bg-ink-700 border border-ink-300/40 rounded px-2 py-1 w-full"
            />
          </label>
        </div>
        <div class="text-xs text-ink-300">
          Tổng: <span class="text-amber-300">{{ totalSell }}</span> linh thạch · {{ feeNote }}
        </div>
        <MButton :loading="submitting" :disabled="!selectedInv" @click="onPost">
          Đăng bán
        </MButton>
      </div>

      <!-- Tin đã đăng -->
      <h3 class="text-base font-bold">Tin của tôi</h3>
      <div v-if="myListings.length === 0" class="text-ink-300 italic">
        Chưa có tin đăng.
      </div>
      <div
        v-for="l in myListings"
        :key="l.id"
        class="rounded border border-ink-300/40 bg-ink-700/30 p-3 flex items-center gap-3"
      >
        <div class="flex-1">
          <span class="font-bold" :class="QUALITY_COLOR[l.item.quality]">
            {{ l.item.name }}
          </span>
          <span class="text-[10px] text-ink-300 ml-1">×{{ l.qty }}</span>
          <span
            class="ml-2 text-[10px] px-1 py-0.5 rounded"
            :class="{
              'bg-emerald-700/40 text-emerald-200': l.status === 'ACTIVE',
              'bg-ink-700/60 text-ink-300': l.status !== 'ACTIVE',
            }"
          >
            {{ l.status }}
          </span>
        </div>
        <div class="text-right">
          <span class="text-amber-300 font-bold">{{ l.totalPrice }}</span>
          <span class="text-[10px] text-ink-300 ml-1">⛀</span>
          <MButton
            v-if="l.status === 'ACTIVE'"
            class="ml-2 !px-2 !py-0.5 text-xs"
            :loading="submitting"
            @click="onCancel(l)"
          >
            Thu hồi
          </MButton>
        </div>
      </div>
    </section>
  </AppShell>
</template>
