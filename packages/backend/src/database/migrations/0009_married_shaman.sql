CREATE TABLE `deletion_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`requested_at` integer DEFAULT (unixepoch()) NOT NULL,
	`scheduled_delete_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deletion_queue_user_id_idx` ON `deletion_queue` (`user_id`);