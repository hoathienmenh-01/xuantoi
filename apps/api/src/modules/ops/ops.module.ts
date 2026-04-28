import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma.service';
import { MailModule } from '../mail/mail.module';
import { OPS_QUEUE } from './ops.queue';
import { OpsService } from './ops.service';
import { OpsProcessor } from './ops.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue({ name: OPS_QUEUE }),
    MailModule,
  ],
  providers: [OpsProcessor, OpsService, PrismaService],
  exports: [OpsService],
})
export class OpsModule implements OnModuleInit {
  constructor(private readonly ops: OpsService) {}

  async onModuleInit(): Promise<void> {
    await this.ops.scheduleRecurring();
  }
}
