import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ChannelsModule],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService, ChannelsModule],
})
export class UsersModule {}
