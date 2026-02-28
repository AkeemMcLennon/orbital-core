CREATE TABLE `contact_relationships` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` blob NOT NULL,
	`related_contact_id` blob NOT NULL,
	`type` text NOT NULL,
	`sentiment` integer DEFAULT 0 NOT NULL,
	`description` text,
	`mirror_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cr_user_id_idx` ON `contact_relationships` (`user_id`);--> statement-breakpoint
CREATE INDEX `cr_contact_id_idx` ON `contact_relationships` (`contact_id`);--> statement-breakpoint
CREATE INDEX `cr_related_contact_id_idx` ON `contact_relationships` (`related_contact_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cr_pair_unique_idx` ON `contact_relationships` (`user_id`,`contact_id`,`related_contact_id`);