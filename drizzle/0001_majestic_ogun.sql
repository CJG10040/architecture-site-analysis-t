CREATE TABLE `aiReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`inputSnapshotIds` text NOT NULL,
	`modelId` varchar(128) NOT NULL,
	`reportJson` text NOT NULL,
	`userEditedJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysisSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`siteId` int,
	`analysisCategory` enum('regulation','environment','transport','parking','facility','manual') NOT NULL,
	`sourceName` varchar(160) NOT NULL,
	`sourceUrl` text,
	`rawPayload` text,
	`normalizedPayload` text,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`datasetUpdatedAt` varchar(64),
	`spatialScope` varchar(160),
	`limitations` text,
	`snapshotStatus` enum('success','empty','unavailable','error') NOT NULL DEFAULT 'success',
	CONSTRAINT `analysisSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `apiAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`operation` varchar(120) NOT NULL,
	`success` boolean NOT NULL,
	`responseStatus` int,
	`safeMessage` varchar(280),
	`initiatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apiAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `apiCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`encryptedValue` text NOT NULL,
	`initializationVector` varchar(64) NOT NULL,
	`authenticationTag` varchar(64) NOT NULL,
	`keyVersion` varchar(32) NOT NULL DEFAULT 'v1',
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastValidatedAt` timestamp,
	`lastValidationError` varchar(280),
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apiCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `apiCredentials_provider_unique` UNIQUE(`provider`)
);
--> statement-breakpoint
CREATE TABLE `designCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`designCardType` enum('fact','observation','interpretation','hypothesis','unknown') NOT NULL,
	`keyword` varchar(80) NOT NULL,
	`claim` text NOT NULL,
	`evidence` text,
	`designApplication` text,
	`sourceSnapshotIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `designCards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fieldObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`note` text NOT NULL,
	`observationType` enum('movement','sound','light','material','boundary','activity','other') NOT NULL DEFAULT 'other',
	`latitude` varchar(32),
	`longitude` varchar(32),
	`observedAt` timestamp,
	`direction` varchar(32),
	`attachmentUrl` text,
	`verificationStatus` enum('unverified','confirmed','conflicts') NOT NULL DEFAULT 'unverified',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fieldObservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parkingFacilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceIdentifier` varchar(64) NOT NULL,
	`stationName` varchar(80),
	`name` varchar(160) NOT NULL,
	`address` text,
	`latitude` varchar(32) NOT NULL,
	`longitude` varchar(32) NOT NULL,
	`capacity` int,
	`feeInfo` varchar(80),
	`facilityType` varchar(80),
	`datasetReferenceDate` varchar(32) NOT NULL DEFAULT '2022-12-08',
	CONSTRAINT `parkingFacilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `parkingFacilities_sourceIdentifier_unique` UNIQUE(`sourceIdentifier`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`architecturalProgram` text,
	`expectedScale` varchar(160),
	`assignmentTheme` text,
	`interestLens` varchar(160),
	`firstQuestion` text,
	`siteVisitStatus` enum('planned','completed','unknown') NOT NULL DEFAULT 'unknown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`address` text,
	`parcelNumber` varchar(64),
	`roadAddress` text,
	`latitude` varchar(32) NOT NULL,
	`longitude` varchar(32) NOT NULL,
	`landAreaSqm` varchar(32),
	`boundaryGeoJson` text,
	`analysisRadiusMeters` int NOT NULL DEFAULT 800,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`),
	CONSTRAINT `sites_projectId_unique` UNIQUE(`projectId`)
);
