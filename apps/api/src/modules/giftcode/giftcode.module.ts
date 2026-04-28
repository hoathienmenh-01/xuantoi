import { Module } from '@nestjs/common';
import { GiftCodeController } from './giftcode.controller';
import { GiftCodeService } from './giftcode.service';
import { AuthModule } from '../auth/auth.module';
import { CharacterModule } from '../character/character.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [AuthModule, CharacterModule, InventoryModule],
  controllers: [GiftCodeController],
  providers: [GiftCodeService, PrismaService],
  exports: [GiftCodeService],
})
export class GiftCodeModule {}
