import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeService, PrismaService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
