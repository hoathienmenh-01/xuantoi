import { Module } from '@nestjs/common';
import { CombatController } from './combat.controller';
import { CombatService } from './combat.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [AuthModule, RealtimeModule, CharacterModule],
  controllers: [CombatController],
  providers: [CombatService, PrismaService],
})
export class CombatModule {}
