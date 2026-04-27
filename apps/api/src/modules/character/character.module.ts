import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CurrencyService } from './currency.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [CharacterController],
  providers: [CharacterService, CurrencyService, PrismaService],
  exports: [CharacterService, CurrencyService],
})
export class CharacterModule {}
