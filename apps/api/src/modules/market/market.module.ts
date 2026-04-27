import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [AuthModule, RealtimeModule, CharacterModule],
  controllers: [MarketController],
  providers: [MarketService, PrismaService],
})
export class MarketModule {}
