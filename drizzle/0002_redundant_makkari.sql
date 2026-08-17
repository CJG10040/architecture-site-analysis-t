CREATE TABLE `fieldAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`observationId` int,
	`attachmentType` enum('photo','sketch','drawing','document','audio','other') NOT NULL,
	`fileKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`latitude` varchar(32),
	`longitude` varchar(32),
	`observedAt` timestamp,
	`direction` varchar(32),
	`transcription` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fieldAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `relationshipCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`relationshipType` enum('adjacency','access','density','time','conflict','repetition','disconnection','coexistence','exclusion','preservation','other') NOT NULL,
	`evidence` text NOT NULL,
	`tensionOrOpportunity` text,
	`additionalResearch` text,
	`relationshipStance` enum('undecided','agree','partial','different','not_important','research','counter','develop') NOT NULL DEFAULT 'undecided',
	`userNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `relationshipCards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `analysisSnapshots` ADD `dataUnit` varchar(120);--> statement-breakpoint
ALTER TABLE `analysisSnapshots` ADD `snapshotReliability` enum('high','medium','low','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `designCards` ADD `designCardReviewStatus` enum('undecided','agree','partial','different','not_important','research','counter','develop') DEFAULT 'undecided' NOT NULL;--> statement-breakpoint
ALTER TABLE `designCards` ADD `reviewNote` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `targetUsers` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `deliverableFormat` varchar(160);--> statement-breakpoint
ALTER TABLE `projects` ADD `avoidInterpretations` text;