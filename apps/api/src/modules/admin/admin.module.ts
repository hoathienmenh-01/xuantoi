import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { TopupModule } from '../topup/topup.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [AuthModule, CharacterModule, TopupModule, RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, PrismaService],
})
export class AdminModule {}
