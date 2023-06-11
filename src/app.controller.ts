import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  chat(@Body() body) {
    return this.appService.chat(body);
  }

  @Post('urls')
  getUrls(@Body('url') url: string) {
    return this.appService.getUrls(url);
  }

  @Post('scan')
  getWebsiteContent(@Body('url') url: string) {
    return this.appService.getWebsiteContent(url);
  }
}
