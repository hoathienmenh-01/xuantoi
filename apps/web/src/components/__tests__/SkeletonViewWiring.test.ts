import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { setActivePinia, createPinia } from 'pinia';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';

/**
 * G14 — sanity test cho cách wire SkeletonBlock vào view (không mount full
 * MissionView/AdminView vì store + router setup quá phức tạp). Test này verify:
 *  - Khi `loading=true` và `items.length === 0` → show skeleton wrapper.
 *  - Khi `loading=false` → ẩn skeleton, show real content.
 *
 * Pattern test này áp dụng được cho mọi view có dạng same: skeleton-on-empty.
 */

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  messages: { vi: {} },
});

beforeEach(() => setActivePinia(createPinia()));

describe('SkeletonBlock wiring patterns', () => {
  it('mission-style: list of skeleton item khi loading + items rỗng', () => {
    const wrapper = mount(
      {
        template: `
          <ul v-if="loading && items.length === 0" data-testid="mission-skeleton">
            <li v-for="i in 4" :key="i" class="block">
              <SkeletonBlock height="h-5" width="w-1/3" />
              <SkeletonBlock height="h-3" width="w-full" />
            </li>
          </ul>
          <ul v-else>
            <li v-for="m in items" :key="m">{{ m }}</li>
          </ul>
        `,
        components: { SkeletonBlock },
        props: ['loading', 'items'],
      },
      {
        props: { loading: true, items: [] },
        global: { plugins: [i18n] },
      },
    );
    expect(wrapper.find('[data-testid="mission-skeleton"]').exists()).toBe(true);
    const skeletonItems = wrapper.findAll('[data-testid="mission-skeleton"] > li');
    expect(skeletonItems.length).toBe(4);
    // 2 SkeletonBlock per item × 4 items = 8 blocks total
    expect(wrapper.findAllComponents(SkeletonBlock).length).toBe(8);
  });

  it('mission-style: ẩn skeleton khi loading=false', () => {
    const wrapper = mount(
      {
        template: `
          <ul v-if="loading && items.length === 0" data-testid="mission-skeleton">
            <li v-for="i in 4" :key="i"></li>
          </ul>
          <ul v-else data-testid="mission-list">
            <li v-for="m in items" :key="m">{{ m }}</li>
          </ul>
        `,
        components: { SkeletonBlock },
        props: ['loading', 'items'],
      },
      {
        props: { loading: false, items: ['a', 'b'] },
        global: { plugins: [i18n] },
      },
    );
    expect(wrapper.find('[data-testid="mission-skeleton"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="mission-list"]').exists()).toBe(true);
  });

  it('admin-stats-style: 3 card skeleton khi !stats', () => {
    const wrapper = mount(
      {
        template: `
          <div v-if="!stats" data-testid="admin-stats-skeleton" class="grid">
            <div v-for="i in 3" :key="i" class="card">
              <SkeletonBlock height="h-4" width="w-1/3" />
              <SkeletonBlock height="h-3" width="w-full" />
              <SkeletonBlock height="h-3" width="w-3/4" />
              <SkeletonBlock height="h-3" width="w-2/3" />
            </div>
          </div>
          <div v-else data-testid="admin-stats">stats</div>
        `,
        components: { SkeletonBlock },
        props: ['stats'],
      },
      {
        props: { stats: null },
        global: { plugins: [i18n] },
      },
    );
    expect(wrapper.find('[data-testid="admin-stats-skeleton"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="admin-stats"]').exists()).toBe(false);
    // 3 cards × 4 blocks = 12
    expect(wrapper.findAllComponents(SkeletonBlock).length).toBe(12);
  });
});
