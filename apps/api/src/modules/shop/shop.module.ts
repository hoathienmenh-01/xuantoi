import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [AuthModule, CharacterModule, InventoryModule],
  controllers: [ShopController],
  providers: [ShopService, PrismaService],
  exports: [ShopService],
})
export class ShopModule {}
