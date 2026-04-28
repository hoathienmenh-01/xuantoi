import { Module } from '@nestjs/common';
import { NextActionController } from './next-action.controller';
import { NextActionService } from './next-action.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NextActionController],
  providers: [NextActionService, PrismaService],
  exports: [NextActionService],
})
export class NextActionModule {}
