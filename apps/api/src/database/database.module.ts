import { Global, Module } from '@nestjs/common';
import { PgService } from './pg.service';

/** Global: PgService her modülde inject edilebilir. */
@Global()
@Module({
  providers: [PgService],
  exports: [PgService],
})
export class DatabaseModule {}
