CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`request_key` text NOT NULL,
	`site_key` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`trade_no` text,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`published_at` integer,
	`last_checked_at` integer,
	`ip_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_owner_request` ON `orders` (`owner_hash`,`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_site_key` ON `orders` (`site_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_trade_no` ON `orders` (`trade_no`);--> statement-breakpoint
CREATE INDEX `orders_created_ip` ON `orders` (`created_at`,`ip_hash`);