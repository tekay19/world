import { Controller, Get } from '@nestjs/common';
import { GlobeService } from './globe.service';

@Controller('globe')
export class GlobeController {
  constructor(private readonly service: GlobeService) {}

  // GET /api/globe/countries → poligon endeks verisi (renklendirme)
  @Get('countries')
  countries() {
    return this.service.listForGlobe();
  }
}
