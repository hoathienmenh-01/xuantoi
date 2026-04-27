import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CharacterModule } from './modules/character/character.module';
import { CombatModule } from './modules/combat/combat.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MarketModule } from './modules/market/market.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { CultivationModule } from './modules/cultivation/cultivation.module';
import { ChatModule } from './modules/chat/chat.module';
import { SectModule } from './modules/sect/sect.module';
import { BossModule } from './modules/boss/boss.module';
import { TopupModule } from './modules/topup/topup.module';
import { AdminModule } from './modules/admin/admin.module';
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
    InventoryModule,
    MarketModule,
    SectModule,
    ChatModule,
    BossModule,
    TopupModule,
    AdminModule,
  ],
})
export class AppModule {}
