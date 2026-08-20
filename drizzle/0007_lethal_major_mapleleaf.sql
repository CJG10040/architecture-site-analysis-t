CREATE TABLE `buildingSurveys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`floorCount` int,
	`estimatedHeightMeters` int,
	`direction` varchar(32),
	`distanceMeters` int,
	`buildingSurveyRelationship` enum('adjacent','across_street','nearby','landmark','other') NOT NULL DEFAULT 'nearby',
	`useOrCondition` varchar(160),
	`notes` text,
	`buildingSurveyVerification` enum('unverified','estimated','confirmed') NOT NULL DEFAULT 'unverified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buildingSurveys_id` PRIMARY KEY(`id`)
);
