import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import NotFoundView from '@/views/NotFoundView.vue';

/**
 * NotFoundView smoke tests (session 9j task J / K3.8): lock down render
 * contract (title + desc + back link). NotFoundView is the catch-all route
 * for `/:pathMatch(.*)*` — regression here means broken deep-linking UX.
 */

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: {
      notFound: {
        title: 'Không tìm thấy trang',
        desc: 'Trang bạn tìm không tồn tại hoặc đã bị xoá',
      },
      common: { back: 'Quay về' },
    },
  },
});

function mountView() {
  return mount(NotFoundView, {
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: {
          name: 'RouterLinkStub',
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });
}

describe('NotFoundView', () => {
  it('render title + desc từ i18n', () => {
    const w = mountView();
    expect(w.text()).toContain('Không tìm thấy trang');
    expect(w.text()).toContain('Trang bạn tìm không tồn tại hoặc đã bị xoá');
  });

  it('render back link với to="/" + label từ i18n', () => {
    const w = mountView();
    const link = w.find('a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/');
    expect(link.text()).toContain('Quay về');
  });
});
