import { Controller, Get, Param } from '@nestjs/common';
import { StructuralService } from './structural.service';

@Controller('countries')
export class StructuralController {
  constructor(private readonly service: StructuralService) {}

  // GET /api/countries/:iso2/structural → Dünya Bankası makro göstergeleri (son değer)
  @Get(':iso2/structural')
  latest(@Param('iso2') iso2: string) {
    return this.service.latest(iso2);
  }
}
