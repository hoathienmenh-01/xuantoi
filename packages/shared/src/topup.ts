/**
 * Topup tiên ngọc — file 04 §7 và 05 phase-8.
 *
 * Mỗi gói có giá VND cố định và số tiên ngọc nhận được. Dev mode dùng
 * "QR demo" — server sinh `transferCode = TOPUP-<short>` để admin
 * verify chuyển khoản thủ công, không gọi gateway thật.
 */
export interface TopupPackage {
  key: string;
  name: string;
  description: string;
  tienNgoc: number;
  priceVND: number;
  bonus: number;
  hot?: boolean;
}

export const TOPUP_PACKAGES: TopupPackage[] = [
  {
    key: 'lien_xuan_50',
    name: 'Liên Xuân — 50 Tiên Ngọc',
    description: 'Gói khởi đầu cho đệ tử nhập môn.',
    tienNgoc: 50,
    priceVND: 20_000,
    bonus: 0,
  },
  {
    key: 'lien_xuan_120',
    name: 'Liên Xuân — 120 Tiên Ngọc',
    description: 'Tặng kèm 10 viên Linh Đan.',
    tienNgoc: 120,
    priceVND: 50_000,
    bonus: 10,
  },
  {
    key: 'tinh_thach_300',
    name: 'Tinh Thạch — 300 Tiên Ngọc',
    description: 'Lưu hành nhất, tặng kèm 50k linh thạch.',
    tienNgoc: 300,
    priceVND: 100_000,
    bonus: 30,
    hot: true,
  },
  {
    key: 'tinh_thach_650',
    name: 'Tinh Thạch — 650 Tiên Ngọc',
    description: 'Bonus 80, đặc quyền VIP 7 ngày.',
    tienNgoc: 650,
    priceVND: 200_000,
    bonus: 80,
  },
  {
    key: 'huyet_long_1500',
    name: 'Huyết Long — 1500 Tiên Ngọc',
    description: 'Bonus 200, mở rương Tiên ngẫu nhiên.',
    tienNgoc: 1500,
    priceVND: 500_000,
    bonus: 200,
  },
  {
    key: 'tien_lai_3500',
    name: 'Tiên Lai — 3500 Tiên Ngọc',
    description: 'Bonus 500, đặc quyền VIP 30 ngày + skin riêng.',
    tienNgoc: 3500,
    priceVND: 1_000_000,
    bonus: 500,
  },
];

export function topupPackageByKey(key: string): TopupPackage | undefined {
  return TOPUP_PACKAGES.find((p) => p.key === key);
}

/**
 * Bank info (demo) hiển thị cho user khi chọn package.
 * Production cần đọc từ env hoặc admin config table.
 */
export const TOPUP_BANK_INFO = {
  bankName: 'Ngân Hàng Thiên Đạo',
  accountName: 'XUANTOI MUD',
  accountNumber: '0000-0000-1888',
  noteHint: 'Nhập đúng mã chuyển khoản để xác nhận đơn nạp.',
};
