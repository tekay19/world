import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './auth.decorators';
import { AuthCredentialsDto } from './auth.dto';
import { AuthUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: AuthCredentialsDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Public()
  @Post('login')
  login(@Body() dto: AuthCredentialsDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
