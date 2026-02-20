DROP INDEX "idx_ingestion_log_source_external_id";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ingestion_log_source_dedup_hash" ON "ingestion_log" USING btree ("source","dedup_hash");--> statement-breakpoint
CREATE INDEX "idx_ingestion_log_source_external_id" ON "ingestion_log" USING btree ("source","external_id");