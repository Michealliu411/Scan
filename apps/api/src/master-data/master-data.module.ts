import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MasterDataController } from './master-data.controller';

@Module({
  imports: [AuthModule, SessionsModule],
  controllers: [MasterDataController]
})
export class MasterDataModule {}
