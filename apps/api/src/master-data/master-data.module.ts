import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';

@Module({
  imports: [AuthModule, PrismaModule, SessionsModule],
  controllers: [MasterDataController],
  providers: [MasterDataService]
})
export class MasterDataModule {}
