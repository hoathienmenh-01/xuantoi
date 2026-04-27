import { Module } from '@nestjs/common';
import { TopupController } from './topup.controller';
import { TopupService } from './topup.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [TopupController],
  providers: [TopupService, PrismaService],
  exports: [TopupService],
})
export class TopupModule {}
