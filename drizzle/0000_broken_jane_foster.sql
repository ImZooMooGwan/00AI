CREATE TABLE `change_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`external_record_id` text NOT NULL,
	`source_id` text NOT NULL,
	`field` text NOT NULL,
	`previous_value` text,
	`current_value` text,
	`previous_hash` text NOT NULL,
	`current_hash` text NOT NULL,
	`detected_at` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `change_candidates_source_idx` ON `change_candidates` (`source_id`);--> statement-breakpoint
CREATE INDEX `change_candidates_review_idx` ON `change_candidates` (`review_status`);--> statement-breakpoint
CREATE TABLE `collection_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`fetched_count` integer DEFAULT 0 NOT NULL,
	`inserted_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`unchanged_count` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `collection_runs_source_idx` ON `collection_runs` (`source_id`);--> statement-breakpoint
CREATE INDEX `collection_runs_started_idx` ON `collection_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `external_records` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`source_record_id` text NOT NULL,
	`record_type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`category` text,
	`region` text,
	`organization` text,
	`canonical_url` text,
	`source_updated_at` text,
	`payload_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_records_source_record_uq` ON `external_records` (`source_id`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `external_records_type_idx` ON `external_records` (`record_type`);--> statement-breakpoint
CREATE INDEX `external_records_last_seen_idx` ON `external_records` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `indicator_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`indicator_id` text NOT NULL,
	`source_id` text NOT NULL,
	`table_id` text,
	`period` text,
	`region_code` text,
	`value` text,
	`unit` text,
	`payload_json` text NOT NULL,
	`observed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `indicator_observations_natural_uq` ON `indicator_observations` (`indicator_id`,`source_id`,`period`,`region_code`);--> statement-breakpoint
CREATE INDEX `indicator_observations_period_idx` ON `indicator_observations` (`period`);--> statement-breakpoint
CREATE TABLE `source_connectors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`endpoint` text NOT NULL,
	`auth_env_key` text NOT NULL,
	`status` text DEFAULT 'key_required' NOT NULL,
	`last_run_at` text,
	`last_success_at` text,
	`last_error` text,
	`last_record_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `source_connectors_status_idx` ON `source_connectors` (`status`);