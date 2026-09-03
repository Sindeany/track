CREATE TABLE `visitComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`managerId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visitPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`objectKey` varchar(512) NOT NULL,
	`objectUrl` varchar(768) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`representativeId` int NOT NULL,
	`clientName` varchar(180) NOT NULL,
	`employeeName` varchar(180) NOT NULL,
	`employeeRole` varchar(180) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`address` text NOT NULL,
	`visitPurpose` enum('quote','follow_up','complaint_follow_up','other') NOT NULL,
	`report` text NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`locationAccuracy` int,
	`visitedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `visitComments` ADD CONSTRAINT `visitComments_visitId_visits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitComments` ADD CONSTRAINT `visitComments_managerId_users_id_fk` FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visitPhotos` ADD CONSTRAINT `visitPhotos_visitId_visits_id_fk` FOREIGN KEY (`visitId`) REFERENCES `visits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visits` ADD CONSTRAINT `visits_representativeId_users_id_fk` FOREIGN KEY (`representativeId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `visit_comments_visit_idx` ON `visitComments` (`visitId`);--> statement-breakpoint
CREATE INDEX `visit_photos_visit_idx` ON `visitPhotos` (`visitId`);--> statement-breakpoint
CREATE INDEX `visits_representative_visited_idx` ON `visits` (`representativeId`,`visitedAt`);--> statement-breakpoint
CREATE INDEX `visits_visited_idx` ON `visits` (`visitedAt`);