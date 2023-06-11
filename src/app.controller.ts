import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  getHello(@Body() body) {
    return this.appService.getHello(body);
  }

  @Get('scan')
  getWebsiteContent() {
    return this.appService.getWebsiteContent('');
  }
}
