<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  EQUIP_SLOTS,
  QUALITY_COLOR,
  type EquipSlot,
  type ItemDef,
} from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import {
  equipItem,
  listInventory,
  unequipItem,
  useItem,
  type InventoryView,
} from '@/api/inventory';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();
const { t } = useI18n();

const items = ref<InventoryView[]>([]);
const submitting = ref(false);

function slotLabel(slot: EquipSlot): string {
  return t(`equipSlot.${slot}`);
}

const equipped = computed(() => {
  const map = new Map<EquipSlot, InventoryView>();
  for (const it of items.value) {
    if (it.equippedSlot) map.set(it.equippedSlot, it);
  }
  return map;
});

const unequipped = computed(() => items.value.filter((i) => !i.equippedSlot));

function bonusText(item: ItemDef): string {
  if (!item.bonuses) return '';
  const parts: string[] = [];
  if (item.bonuses.atk) parts.push(t('inventory.bonus.atk', { v: item.bonuses.atk }));
  if (item.bonuses.def) parts.push(t('inventory.bonus.def', { v: item.bonuses.def }));
  if (item.bonuses.hpMax) parts.push(t('inventory.bonus.hpMax', { v: item.bonuses.hpMax }));
  if (item.bonuses.mpMax) parts.push(t('inventory.bonus.mpMax', { v: item.bonuses.mpMax }));
  if (item.bonuses.spirit) parts.push(t('inventory.bonus.spirit', { v: item.bonuses.spirit }));
  return parts.join(' · ');
}

function effectText(item: ItemDef): string {
  if (!item.effect) return '';
  const parts: string[] = [];
  if (item.effect.hp) parts.push(`+${item.effect.hp} HP`);
  if (item.effect.mp) parts.push(`+${item.effect.mp} MP`);
  if (item.effect.exp) parts.push(`+${item.effect.exp} EXP`);
  return parts.join(' · ');
}

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
  try {
    items.value = await listInventory();
  } catch {
    toast.push({ type: 'error', text: t('inventory.loadFailToast') });
  }
});

async function onEquip(it: InventoryView): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    items.value = await equipItem(it.id);
    toast.push({ type: 'success', text: t('inventory.equipToast', { name: it.item.name }) });
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onUnequip(slot: EquipSlot): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    items.value = await unequipItem(slot);
    toast.push({ type: 'system', text: t('inventory.unequipToast', { slot: slotLabel(slot) }) });
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onUse(it: InventoryView): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    items.value = await useItem(it.id);
    toast.push({ type: 'success', text: t('inventory.useToast', { name: it.item.name }) });
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

function handleErr(e: unknown): void {
  const code = (e as { code?: string })?.code ?? 'UNKNOWN';
  const text = t(`inventory.errors.${code}`, '__missing__');
  toast.push({
    type: 'error',
    text: text === '__missing__' ? t('inventory.errors.UNKNOWN') : text,
  });
}
</script>

<template>
  <AppShell>
    <h2 class="text-xl tracking-widest mb-4">{{ t('inventory.title') }}</h2>

    <div class="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <!-- Bộ trang bị -->
      <section class="rounded border border-ink-300/40 bg-ink-700/30 p-4 space-y-2">
        <h3 class="text-base font-bold mb-2">{{ t('inventory.gearTitle') }}</h3>
        <div
          v-for="slot in EQUIP_SLOTS"
          :key="slot"
          class="flex items-center justify-between text-sm border-b border-ink-300/20 last:border-0 py-2"
        >
          <span class="text-ink-300 w-24">{{ slotLabel(slot) }}</span>
          <span v-if="equipped.get(slot)" :class="QUALITY_COLOR[equipped.get(slot)!.item.quality]">
            {{ equipped.get(slot)!.item.name }}
          </span>
          <span v-else class="italic text-ink-300/60">{{ t('inventory.empty') }}</span>
          <MButton
            v-if="equipped.get(slot)"
            class="ml-auto !px-2 !py-0.5 text-xs"
            @click="onUnequip(slot)"
          >
            {{ t('inventory.takeOff') }}
          </MButton>
        </div>
      </section>

      <!-- Danh sách item chưa đeo -->
      <section class="space-y-3">
        <div v-if="unequipped.length === 0" class="text-ink-300 italic">
          {{ t('inventory.emptyAll') }}
        </div>
        <div
          v-for="it in unequipped"
          :key="it.id"
          class="rounded border border-ink-300/40 bg-ink-700/30 p-3 flex items-center gap-3"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-bold" :class="QUALITY_COLOR[it.item.quality]">
                {{ it.item.name }}
              </span>
              <span class="text-[10px] text-ink-300">
                {{ t('quality.' + it.item.quality) }} ·
                {{ it.item.kind }} ·
                ×{{ it.qty }}
              </span>
            </div>
            <p class="text-xs text-ink-300 mt-0.5">{{ it.item.description }}</p>
            <p v-if="it.item.bonuses" class="text-xs text-emerald-300">
              {{ bonusText(it.item) }}
            </p>
            <p v-else-if="it.item.effect" class="text-xs text-amber-200">
              {{ effectText(it.item) }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <MButton v-if="it.item.slot" :loading="submitting" @click="onEquip(it)">
              {{ t('inventory.equip') }}
            </MButton>
            <MButton v-if="it.item.effect" :loading="submitting" @click="onUse(it)">
              {{ t('inventory.use') }}
            </MButton>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
</template>
