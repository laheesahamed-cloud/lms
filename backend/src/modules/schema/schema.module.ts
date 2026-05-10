import { Module } from '@nestjs/common';
import { SchemaSyncService } from './schema-sync.service';

@Module({
  providers: [SchemaSyncService],
})
export class SchemaModule {}
