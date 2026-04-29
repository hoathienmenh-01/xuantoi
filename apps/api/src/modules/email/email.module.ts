import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Global SMTP email module — `EmailService` available cho mọi feature module
 * (auth forgot-password trước mắt). `@Global()` để không phải import lại
 * trong từng feature module.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
