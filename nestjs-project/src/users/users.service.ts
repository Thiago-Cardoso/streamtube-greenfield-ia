import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ChannelsService } from '../channels/channels.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly channelsService: ChannelsService,
  ) {}

  async createUserWithChannel(email: string, hashedPassword: string): Promise<User> {
    const user = await this.userRepository.save(
      this.userRepository.create({ email, password: hashedPassword }),
    );

    try {
      const channel = await this.channelsService.createChannel(user.id, email);
      user.channel = channel;
      return user;
    } catch (err) {
      await this.userRepository.delete(user.id);
      throw err;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByEmailWithChannel(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['channel'],
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }
}
