<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AUTH_ERROR_VI, randomProverb, type AuthErrorCode } from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import MButton from '@/components/ui/MButton.vue';
import * as authApi from '@/api/auth';

type Tab = 'login' | 'register' | 'change';
const tab = ref<Tab>('login');
const proverb = ref(randomProverb());

const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();

function redirectAfterLogin(): string {
  const r = route.query.redirect;
  if (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')) return r;
  return '/home';
}

// login form
const lEmail = ref('');
const lPassword = ref('');
const lRemember = ref(true);

// register form
const rEmail = ref('');
const rPassword = ref('');

// change-password form
const cOld = ref('');
const cNew = ref('');

const STRENGTH_LABELS = ['Yếu', 'Trung bình', 'Khá', 'Mạnh', 'Rất mạnh'] as const;
function passwordStrength(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 5);
}
const rStrength = computed(() => passwordStrength(rPassword.value));
const rStrengthLabel = computed(() =>
  rStrength.value === 0 ? '—' : STRENGTH_LABELS[rStrength.value - 1],
);

function showServerError(code: string): void {
  const known = (Object.keys(AUTH_ERROR_VI) as AuthErrorCode[]).includes(code as AuthErrorCode);
  toast.push({
    type: 'error',
    text: known ? AUTH_ERROR_VI[code as AuthErrorCode] : 'Có lỗi xảy ra, mời thử lại.',
  });
}

async function onLogin(): Promise<void> {
  try {
    await auth.login(lEmail.value, lPassword.value, lRemember.value);
    toast.push({ type: 'success', text: 'Nhập định thành công.' });
    router.push(redirectAfterLogin());
  } catch (e) {
    showServerError((e as { code?: string })?.code ?? 'INVALID_CREDENTIALS');
  }
}

async function onRegister(): Promise<void> {
  try {
    await auth.register(rEmail.value, rPassword.value);
    toast.push({
      type: 'success',
      text: 'Khai tông lập danh thành công. Mời đạo hữu nhập định tu hành.',
    });
    router.push(redirectAfterLogin());
  } catch (e) {
    showServerError((e as { code?: string })?.code ?? 'EMAIL_TAKEN');
  }
}

async function onChange(): Promise<void> {
  try {
    await authApi.changePassword({ oldPassword: cOld.value, newPassword: cNew.value });
    toast.push({ type: 'success', text: 'Đổi pháp thành công.' });
    cOld.value = '';
    cNew.value = '';
  } catch (e) {
    showServerError((e as { code?: string })?.code ?? 'OLD_PASSWORD_WRONG');
  }
}
</script>

<template>
  <div
    class="min-h-screen w-full flex items-center justify-center p-4 bg-ink-900"
    style="background: radial-gradient(ellipse at top, #2a1f10 0%, #1b150a 60%, #0e0a04 100%)"
  >
    <div
      class="w-full max-w-md border-2 border-ink-300/60 rounded-md bg-ink-700/40 backdrop-blur-md p-6 shadow-2xl"
    >
      <h1 class="text-3xl text-center text-ink-100 tracking-widest">Đạo Môn</h1>
      <p class="text-center text-ink-300 italic mt-2 text-sm">"{{ proverb }}"</p>

      <div class="flex justify-center gap-1 mt-5 border-b border-ink-300/40">
        <button
          v-for="t in (['login', 'register', 'change'] as const)"
          :key="t"
          class="px-3 py-2 text-sm transition"
          :class="tab === t ? 'text-ink-50 border-b-2 border-ink-300' : 'text-ink-300'"
          @click="tab = t"
        >
          {{ t === 'login' ? 'Đăng Nhập' : t === 'register' ? 'Đăng Ký' : 'Đổi Mật Khẩu' }}
        </button>
      </div>

      <!-- LOGIN -->
      <form v-if="tab === 'login'" class="mt-5 space-y-3" @submit.prevent="onLogin">
        <label class="block">
          <span class="text-ink-300 text-sm">Tài Khoản (Email)</span>
          <input
            v-model="lEmail"
            type="email"
            required
            class="mt-1 w-full bg-ink-900/60 border border-ink-300/40 rounded px-3 py-2 text-ink-50"
          />
        </label>
        <label class="block">
          <span class="text-ink-300 text-sm">Huyền Pháp Bảo Hộ (Mật Khẩu)</span>
          <input
            v-model="lPassword"
            type="password"
            required
            class="mt-1 w-full bg-ink-900/60 border border-ink-300/40 rounded px-3 py-2 text-ink-50"
          />
        </label>
        <div class="flex items-center justify-between text-xs">
          <label class="flex items-center gap-2 text-ink-300">
            <input v-model="lRemember" type="checkbox" /> Ghi nhớ email
          </label>
          <span class="text-ink-300/80">Mật khẩu sẽ được bảo vệ theo phiên.</span>
        </div>
        <MButton type="submit" :loading="auth.loading" class="w-full">Nhập Định Tu Hành</MButton>
      </form>

      <!-- REGISTER -->
      <form v-else-if="tab === 'register'" class="mt-5 space-y-3" @submit.prevent="onRegister">
        <label class="block">
          <span class="text-ink-300 text-sm">Tài Khoản (Email)</span>
          <input
            v-model="rEmail"
            type="email"
            required
            class="mt-1 w-full bg-ink-900/60 border border-ink-300/40 rounded px-3 py-2 text-ink-50"
          />
        </label>
        <label class="block">
          <span class="text-ink-300 text-sm">Huyền Pháp Bảo Hộ (Mật Khẩu)</span>
          <input
            v-model="rPassword"
            type="password"
            required
            minlength="8"
            class="mt-1 w-full bg-ink-900/60 border border-ink-300/40 rounded px-3 py-2 text-ink-50"
          />
        </label>
        <div class="text-xs text-ink-300">
          Độ mạnh: <span class="font-bold text-ink-50">{{ rStrengthLabel }}</span>
          <div class="h-1 mt-1 rounded bg-ink-900/60 overflow-hidden">
            <div
              class="h-full bg-ink-300 transition-all"
              :style="{ width: (rStrength * 20) + '%' }"
            />
          </div>
        </div>
        <MButton type="submit" :loading="auth.loading" class="w-full">Khai Tông Lập Danh</MButton>
      </form>

      <!-- CHANGE PASSWORD -->
      <form v-else class="mt-5 space-y-3" @submit.prevent="onChange">
        <label class="block">
          <span class="text-ink-300 text-sm">Huyền Pháp Cũ</span>
          <input
            v-model="cOld"
            type="password"
            required
            class="mt-1 w-full bg-ink-900/60 border border-ink-300/40 rounded px-3 py-2 text-ink-50"
          />
        </label>
        <label class="block">
          <span class="text-ink-300 text-sm">Huyền Pháp Mới</span>
          <input
            v-model="cNew"
            type="password"
            required
            minlength="8"
            class="mt-1 w-full bg-ink-900/60 border border-ink-300/40 rounded px-3 py-2 text-ink-50"
          />
        </label>
        <MButton type="submit" class="w-full">Đổi pháp</MButton>
      </form>
    </div>
  </div>
</template>
