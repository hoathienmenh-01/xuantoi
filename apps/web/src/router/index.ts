import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/views/AuthView.vue'),
    meta: { public: true },
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/OnboardingView.vue'),
  },
  {
    path: '/dungeon',
    name: 'dungeon',
    component: () => import('@/views/DungeonView.vue'),
  },
  {
    path: '/inventory',
    name: 'inventory',
    component: () => import('@/views/InventoryView.vue'),
  },
  {
    path: '/market',
    name: 'market',
    component: () => import('@/views/MarketView.vue'),
  },
  {
    path: '/shop',
    name: 'shop',
    component: () => import('@/views/ShopView.vue'),
  },
  {
    path: '/sect',
    name: 'sect',
    component: () => import('@/views/SectView.vue'),
  },
  {
    path: '/boss',
    name: 'boss',
    component: () => import('@/views/BossView.vue'),
  },
  {
    path: '/missions',
    name: 'missions',
    component: () => import('@/views/MissionView.vue'),
  },
  {
    path: '/mail',
    name: 'mail',
    component: () => import('@/views/MailView.vue'),
  },
  {
    path: '/giftcode',
    name: 'giftcode',
    component: () => import('@/views/GiftCodeView.vue'),
  },
  {
    path: '/topup',
    name: 'topup',
    component: () => import('@/views/TopupView.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminView.vue'),
  },
  {
    path: '/profile/:id',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
