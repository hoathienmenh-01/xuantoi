import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CurrencyService } from './currency.service';
import { GameLogService } from './game-log.service';

@Module({
  imports: [AuthModule],
  controllers: [CharacterController],
  providers: [CharacterService, CurrencyService, GameLogService],
  exports: [CharacterService, CurrencyService, GameLogService],
})
export class CharacterModule {}
