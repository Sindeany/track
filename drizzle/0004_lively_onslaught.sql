CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`address` text NOT NULL,
	`contactPerson` varchar(180),
	`contactRole` varchar(180),
	`phone` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);