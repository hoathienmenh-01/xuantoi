<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import { changePassword, logoutAll } from '@/api/auth';
import { setLocale, type LocaleKey } from '@/i18n';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();
const { t, locale } = useI18n();

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const submittingPwd = ref(false);
const submittingLogoutAll = ref(false);

const passwordMismatch = computed(
  () => newPassword.value.length > 0 && newPassword.value !== confirmPassword.value,
);
const passwordTooShort = computed(
  () => newPassword.value.length > 0 && newPassword.value.length < 8,
);

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
});

async function submitChangePassword(): Promise<void> {
  if (submittingPwd.value) return;
  if (!oldPassword.value || !newPassword.value) {
    toast.push({ type: 'error', text: t('settings.password.empty') });
    return;
  }
  if (passwordMismatch.value) {
    toast.push({ type: 'error', text: t('settings.password.mismatch') });
    return;
  }
  if (passwordTooShort.value) {
    toast.push({ type: 'error', text: t('settings.password.tooShort') });
    return;
  }
  submittingPwd.value = true;
  try {
    await changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    toast.push({ type: 'success', text: t('settings.password.success') });
    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    // Đổi mật khẩu đã revoke toàn bộ refresh token → logout luôn về /auth.
    await auth.logout();
    router.replace('/auth');
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'UNKNOWN';
    const text = t(`settings.errors.${code}`, '__missing__');
    toast.push({
      type: 'error',
      text: text === '__missing__' ? t('settings.errors.UNKNOWN') : text,
    });
  } finally {
    submittingPwd.value = false;
  }
}

async function submitLogoutAll(): Promise<void> {
  if (submittingLogoutAll.value) return;
  if (!window.confirm(t('settings.logoutAll.confirm'))) return;
  submittingLogoutAll.value = true;
  try {
    const r = await logoutAll();
    toast.push({
      type: 'success',
      text: t('settings.logoutAll.success', { revoked: r.revoked }),
    });
    auth.user = null;
    router.replace('/auth');
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'UNKNOWN';
    const text = t(`settings.errors.${code}`, '__missing__');
    toast.push({
      type: 'error',
      text: text === '__missing__' ? t('settings.errors.UNKNOWN') : text,
    });
  } finally {
    submittingLogoutAll.value = false;
  }
}

function changeLocale(value: string): void {
  if (value !== 'vi' && value !== 'en') return;
  setLocale(value as LocaleKey);
  toast.push({ type: 'success', text: t('settings.locale.changed') });
}
</script>

<template>
  <AppShell>
    <div class="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 class="text-2xl tracking-widest font-bold">{{ t('settings.title') }}</h1>
        <p class="text-xs text-ink-300 mt-1">{{ t('settings.subtitle') }}</p>
      </header>

      <!-- Account info -->
      <section class="bg-ink-700/30 border border-ink-300/20 rounded p-4 space-y-2 text-sm">
        <h2 class="text-amber-200 text-base">{{ t('settings.account.title') }}</h2>
        <dl class="grid grid-cols-2 gap-2">
          <dt class="text-ink-300">{{ t('settings.account.email') }}</dt>
          <dd>{{ auth.user?.email ?? '—' }}</dd>
          <dt class="text-ink-300">{{ t('settings.account.role') }}</dt>
          <dd>{{ auth.user?.role ?? 'PLAYER' }}</dd>
          <dt class="text-ink-300">{{ t('settings.account.createdAt') }}</dt>
          <dd>{{ auth.user ? new Date(auth.user.createdAt).toLocaleString() : '—' }}</dd>
        </dl>
      </section>

      <!-- Change password -->
      <section class="bg-ink-700/30 border border-ink-300/20 rounded p-4 space-y-3 text-sm">
        <h2 class="text-amber-200 text-base">{{ t('settings.password.title') }}</h2>
        <p class="text-xs text-ink-300">{{ t('settings.password.hint') }}</p>
        <label class="block">
          <span class="text-ink-300">{{ t('settings.password.old') }}</span>
          <input
            v-model="oldPassword"
            type="password"
            autocomplete="current-password"
            class="w-full bg-ink-700/40 border border-ink-300/30 rounded px-2 py-1 mt-1"
          />
        </label>
        <label class="block">
          <span class="text-ink-300">{{ t('settings.password.new') }}</span>
          <input
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full bg-ink-700/40 border border-ink-300/30 rounded px-2 py-1 mt-1"
          />
          <span v-if="passwordTooShort" class="text-red-400 text-xs mt-1 block">
            {{ t('settings.password.tooShort') }}
          </span>
        </label>
        <label class="block">
          <span class="text-ink-300">{{ t('settings.password.confirm') }}</span>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="w-full bg-ink-700/40 border border-ink-300/30 rounded px-2 py-1 mt-1"
          />
          <span v-if="passwordMismatch" class="text-red-400 text-xs mt-1 block">
            {{ t('settings.password.mismatch') }}
          </span>
        </label>
        <MButton
          :disabled="submittingPwd || !oldPassword || !newPassword || passwordMismatch || passwordTooShort"
          @click="submitChangePassword()"
        >
          {{ t('settings.password.submit') }}
        </MButton>
      </section>

      <!-- Locale -->
      <section class="bg-ink-700/30 border border-ink-300/20 rounded p-4 space-y-2 text-sm">
        <h2 class="text-amber-200 text-base">{{ t('settings.locale.title') }}</h2>
        <select
          :value="locale"
          class="bg-ink-700/40 border border-ink-300/30 rounded px-2 py-1"
          @change="changeLocale(($event.target as HTMLSelectElement).value)"
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </section>

      <!-- Logout all sessions -->
      <section class="bg-ink-700/30 border border-red-400/30 rounded p-4 space-y-2 text-sm">
        <h2 class="text-red-300 text-base">{{ t('settings.logoutAll.title') }}</h2>
        <p class="text-xs text-ink-300">{{ t('settings.logoutAll.hint') }}</p>
        <button
          :disabled="submittingLogoutAll"
          class="px-5 py-2 rounded border border-red-400/40 bg-red-700/30 text-red-100 hover:bg-red-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          @click="submitLogoutAll()"
        >
          {{ t('settings.logoutAll.submit') }}
        </button>
      </section>
    </div>
  </AppShell>
</template>
