import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { LogsController } from './logs.controller';

@Module({
  imports: [AuthModule, CharacterModule],
  controllers: [LogsController],
})
export class LogsModule {}
