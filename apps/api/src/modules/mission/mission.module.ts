import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { MissionProcessor } from './mission.processor';
import { MissionScheduler } from './mission.scheduler';
import { MISSION_QUEUE } from './mission.queue';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    AuthModule,
    CharacterModule,
    InventoryModule,
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env.REDIS_URL ?? 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue({ name: MISSION_QUEUE }),
  ],
  controllers: [MissionController],
  providers: [MissionService, MissionProcessor, MissionScheduler, PrismaService],
  exports: [MissionService],
})
export class MissionModule {}
