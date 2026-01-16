CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_external_id_unique` ON `users` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`avatar_url` text,
	`job_title` text,
	`company` text,
	`notes` text,
	`group` text,
	`last_interaction_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contacts_user_id_idx` ON `contacts` (`user_id`);--> statement-breakpoint
CREATE TABLE `directory` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`active_contact_id` blob,
	`source` text NOT NULL,
	`external_id` text,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`avatar_url` text,
	`company` text,
	`raw_metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `directory_user_id_idx` ON `directory` (`user_id`);--> statement-breakpoint
CREATE INDEX `directory_available_idx` ON `directory` (`user_id`,`active_contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `directory_user_id_source_external_id_unique` ON `directory` (`user_id`,`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `contact_tags` (
	`contact_id` blob NOT NULL,
	`tag_id` blob NOT NULL,
	PRIMARY KEY(`contact_id`, `tag_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_tags_tag_id_idx` ON `contact_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `contact_tags_contact_id_idx` ON `contact_tags` (`contact_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tags_user_id_idx` ON `tags` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_user_id_name_unique` ON `tags` (`user_id`,`name`);