import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LogsController],
  providers: [LogsService, PrismaService],
  exports: [LogsService],
})
export class LogsModule {}
