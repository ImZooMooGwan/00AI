CREATE TABLE IF NOT EXISTS `project_profiles` (
  `project_id` text PRIMARY KEY NOT NULL,
  `organization` text NOT NULL,
  `uploader_name` text NOT NULL,
  `description` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
