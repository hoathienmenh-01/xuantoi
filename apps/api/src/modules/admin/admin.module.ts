import { forwardRef, Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AdminLiveOpsService } from './admin-liveops.service';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { TopupModule } from '../topup/topup.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { GiftCodeModule } from '../giftcode/giftcode.module';
import { MailModule } from '../mail/mail.module';
import { InventoryModule } from '../inventory/inventory.module';
import { QuestModule } from '../quest/quest.module';
import { BossModule } from '../boss/boss.module';
import { PrismaService } from '../../common/prisma.service';

// Phase 13.1.B — register `AdminLiveOpsService` for liveops controls +
// sect-war read-only status / recalculate placeholder.
// Phase 13.1.B advanced — `forwardRef(BossModule)` để inject `BossService`
// vào `AdminLiveOpsService.forceBossSchedule` mà KHÔNG phá circular dep
// với `BossModule.imports = [AdminModule]` (BossController dùng AdminGuard).
@Module({
  imports: [
    AuthModule,
    CharacterModule,
    TopupModule,
    RealtimeModule,
    GiftCodeModule,
    MailModule,
    InventoryModule,
    QuestModule,
    forwardRef(() => BossModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, AdminLiveOpsService, PrismaService],
  exports: [AdminGuard, AdminLiveOpsService],
})
export class AdminModule {}
