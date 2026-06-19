import { Controller, Get } from '@nestjs/common';
import { SignalsService } from './signals.service';

@Controller('signals')
export class SignalsController {
  constructor(private readonly service: SignalsService) {}

  // GET /api/signals → piyasa sinyalleri (kur/petrol/altın/Fed) son değer + 30g değişim
  @Get()
  latest() {
    return this.service.latestAll();
  }
}
