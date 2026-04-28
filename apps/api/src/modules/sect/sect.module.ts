import { Module } from '@nestjs/common';
import { SectService } from './sect.service';
import { SectController } from './sect.controller';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { MissionModule } from '../mission/mission.module';

@Module({
  imports: [RealtimeModule, AuthModule, CharacterModule, MissionModule],
  controllers: [SectController],
  providers: [SectService, PrismaService],
  exports: [SectService],
})
export class SectModule {}
