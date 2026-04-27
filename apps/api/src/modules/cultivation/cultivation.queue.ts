// Tách const ra file riêng để tránh circular import giữa
// cultivation.service.ts và cultivation.module.ts khiến @InjectQueue nhận
// undefined → bullmq fallback về 'BullQueue_default' và DI fail lúc bootstrap.
export const CULTIVATION_QUEUE = 'cultivation';
