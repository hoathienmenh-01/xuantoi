import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CharacterModule } from './modules/character/character.module';
import { CombatModule } from './modules/combat/combat.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { CultivationModule } from './modules/cultivation/cultivation.module';
import { RedisModule } from './common/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    AuthModule,
    RealtimeModule,
    CharacterModule,
    CultivationModule,
    CombatModule,
  ],
})
export class AppModule {}
