CREATE TABLE `contact_channels` (
	`id` blob PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`label` text,
	`is_primary` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_channels_contact_id_idx` ON `contact_channels` (`contact_id`);--> statement-breakpoint
CREATE INDEX `contact_channels_value_idx` ON `contact_channels` (`value`);--> statement-breakpoint
CREATE INDEX `contact_channels_type_idx` ON `contact_channels` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `contact_channels_unique` ON `contact_channels` (`contact_id`,`type`,`value`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`account_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_expires_at` integer,
	`last_sync_token` text,
	`last_sync_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `integrations_user_id_idx` ON `integrations` (`user_id`);--> statement-breakpoint
CREATE INDEX `integrations_source_idx` ON `integrations` (`user_id`,`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_user_source_account_unique` ON `integrations` (`user_id`,`source`,`account_id`);--> statement-breakpoint
ALTER TABLE `directory` ADD `secondary_data` text;