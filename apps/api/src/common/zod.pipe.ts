import { HttpStatus, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, infer as zInfer } from 'zod';
import { ApiException } from './api-exception';

/**
 * Pipe parse body bằng zod schema. Khi fail, ném ApiException(`code`, 400).
 * Cách dùng:
 *   @Post('x') foo(@Body(new ZodBody(MySchema, 'BAD_INPUT')) body: MyType) { ... }
 */
export class ZodBody<S extends ZodTypeAny> implements PipeTransform {
  constructor(
    private readonly schema: S,
    private readonly errorCode: string = 'BAD_INPUT',
  ) {}

  transform(value: unknown): zInfer<S> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? this.errorCode;
      throw new ApiException(this.errorCode, HttpStatus.BAD_REQUEST, message);
    }
    return parsed.data;
  }
}
