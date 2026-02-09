CREATE TABLE `oauth_sessions` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`metadata` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_sessions_user_id_idx` ON `oauth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_sessions_provider_idx` ON `oauth_sessions` (`provider`,`expires_at`);