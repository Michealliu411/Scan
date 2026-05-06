import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username }
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id }
    });
  }

  verifyPassword(user: Pick<User, 'passwordHash'>, password: string): Promise<boolean> {
    return argon2.verify(user.passwordHash, password);
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false
      }
    });
  }
}
