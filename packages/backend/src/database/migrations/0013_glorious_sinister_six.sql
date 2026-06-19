CREATE TABLE `user_preferences` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_preferences_user_id_idx` ON `user_preferences` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contact_channels` (
	`id` blob PRIMARY KEY NOT NULL,
	`contact_id` blob NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`label` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_contact_channels`("id", "contact_id", "type", "value", "label", "is_primary", "created_at") SELECT "id", "contact_id", "type", "value", "label", "is_primary", "created_at" FROM `contact_channels`;--> statement-breakpoint
DROP TABLE `contact_channels`;--> statement-breakpoint
ALTER TABLE `__new_contact_channels` RENAME TO `contact_channels`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `contact_channels_contact_id_idx` ON `contact_channels` (`contact_id`);--> statement-breakpoint
CREATE INDEX `contact_channels_value_idx` ON `contact_channels` (`value`);--> statement-breakpoint
CREATE INDEX `contact_channels_type_idx` ON `contact_channels` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `contact_channels_unique` ON `contact_channels` (`contact_id`,`type`,`value`);