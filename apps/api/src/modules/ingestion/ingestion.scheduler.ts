import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { INGESTION_QUEUE, INGEST_JOBS } from './ingestion.constants';

/** Çekim aralığı (dakika). Çok sık çekmek gereksiz yük + kaynak 429'ları doğurur. */
const FETCH_INTERVAL_MIN = 30;

/** Tam-metin zenginleştirme aralığı (dakika). Küçük partiler, çekimden bağımsız. */
const ENRICH_INTERVAL_MIN = 10;

/** Tekrarlayan çekim işini kuyruğa kaydeder. */
@Injectable()
export class IngestionScheduler implements OnModuleInit {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Aralık değişmiş olabilir; Redis'te kalan eski tekrar işlerini temizle
      // (yoksa eski ve yeni aralık birlikte çalışır).
      const repeatables = await this.queue.getRepeatableJobs();
      const managed: string[] = [
        INGEST_JOBS.FETCH_ALL,
        INGEST_JOBS.ENRICH_FULLTEXT,
      ];
      for (const r of repeatables) {
        if (managed.includes(r.name)) {
          await this.queue.removeRepeatableByKey(r.key);
        }
      }

      // Sürekli ama ılımlı çekim.
      await this.queue.add(
        INGEST_JOBS.FETCH_ALL,
        {},
        {
          repeat: { every: FETCH_INTERVAL_MIN * 60 * 1000 },
          jobId: 'fetch-all-repeat',
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );

      // Tam-metin zenginleştirme (çekimden bağımsız, daha sık küçük partiler).
      await this.queue.add(
        INGEST_JOBS.ENRICH_FULLTEXT,
        {},
        {
          repeat: { every: ENRICH_INTERVAL_MIN * 60 * 1000 },
          jobId: 'enrich-fulltext-repeat',
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );

      // Açılışta bir kez çek (ilk aralığı beklemeden haber aksın).
      await this.queue.add(
        INGEST_JOBS.FETCH_ALL,
        {},
        {
          jobId: 'fetch-all-initial',
          delay: 8_000,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log(
        `Çekim zamanlandı: her ${FETCH_INTERVAL_MIN} dk + açılış çekimi; ` +
          `tam-metin her ${ENRICH_INTERVAL_MIN} dk.`,
      );
    } catch (err) {
      // Redis düşükse uygulama yine ayakta kalır (graceful degradation).
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tekrarlayan iş kaydedilemedi (Redis?): ${msg}`);
    }
  }
}
