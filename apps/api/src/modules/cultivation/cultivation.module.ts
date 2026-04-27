import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { CultivationController } from './cultivation.controller';
import { CultivationService } from './cultivation.service';

@Module({
  imports: [AuthModule, CharacterModule],
  controllers: [CultivationController],
  providers: [CultivationService],
  exports: [CultivationService],
})
export class CultivationModule {}
