import { Module } from '@nestjs/common';
import { BossService } from './boss.service';
import { BossController } from './boss.controller';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MissionModule } from '../mission/mission.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    RealtimeModule,
    AuthModule,
    CharacterModule,
    InventoryModule,
    MissionModule,
    AdminModule,
  ],
  controllers: [BossController],
  providers: [BossService, PrismaService],
  exports: [BossService],
})
export class BossModule {}
