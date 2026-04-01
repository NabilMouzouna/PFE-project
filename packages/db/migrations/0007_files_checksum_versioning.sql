ALTER TABLE `files` ADD `checksum` text;--> statement-breakpoint
ALTER TABLE `files` ADD `logical_file_id` text;--> statement-breakpoint
ALTER TABLE `files` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `files` SET `logical_file_id` = `id` WHERE `logical_file_id` IS NULL;
