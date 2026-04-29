import { Module } from '@nestjs/common';
import { DailyLoginController } from './daily-login.controller';
import { DailyLoginService } from './daily-login.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [AuthModule, CharacterModule],
  controllers: [DailyLoginController],
  providers: [DailyLoginService, PrismaService],
  exports: [DailyLoginService],
})
export class DailyLoginModule {}
