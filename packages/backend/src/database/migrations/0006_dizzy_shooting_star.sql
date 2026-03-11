CREATE TABLE `memory_reps` (
	`id` blob PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` blob NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`correct_answer` integer NOT NULL,
	`source_field` text NOT NULL,
	`question_type` text DEFAULT 'detail' NOT NULL,
	`answered_at` integer,
	`was_correct` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memory_reps_user_id_idx` ON `memory_reps` (`user_id`);--> statement-breakpoint
CREATE INDEX `memory_reps_contact_id_idx` ON `memory_reps` (`contact_id`);--> statement-breakpoint
CREATE INDEX `memory_reps_user_unanswered_idx` ON `memory_reps` (`user_id`,`answered_at`);