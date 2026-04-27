/**
 * 7 câu thiền hiển thị random ở tab Đăng Nhập (file 02 §1.3).
 * Khi tích hợp Auth Phase 1, dùng helper randomProverb().
 */
export const PROVERBS: readonly string[] = [
  'Tâm tịnh như nước, đạo tự nhiên thành.',
  'Một niệm khởi, vạn pháp sinh.',
  'Vô vi nhi vô bất vi.',
  'Đạo khả đạo, phi thường đạo.',
  'Thiên hành kiện, quân tử dĩ tự cường bất tức.',
  'Phù tiên giả, thần dữ đạo hợp.',
  'Tu thân, tề gia, trị quốc, bình thiên hạ.',
] as const;

export function randomProverb(rng: () => number = Math.random): string {
  return PROVERBS[Math.floor(rng() * PROVERBS.length)];
}
