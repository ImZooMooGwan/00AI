CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` integer NOT NULL,
	`storage_path` text NOT NULL,
	`file_count` integer NOT NULL,
	`total_size` integer NOT NULL,
	`status` text DEFAULT 'stored' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`visibility` text DEFAULT 'unlisted' NOT NULL,
	`status` text DEFAULT 'ready_for_domain' NOT NULL,
	`public_url` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);