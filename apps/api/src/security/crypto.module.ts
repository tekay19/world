import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/** Global: CryptoService her modülde inject edilebilir. */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
