CREATE TABLE `investigationPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`selectedLenses` text NOT NULL,
	`priorityOrder` text NOT NULL,
	`recommendedDatasets` text NOT NULL,
	`approvedDatasetIds` text NOT NULL,
	`contextScopes` text NOT NULL,
	`investigationPlanStatus` enum('draft','approved','collecting','collected','partial') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investigationPlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `investigationPlans_projectId_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `siteParcels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`pnu` varchar(32),
	`parcelNumber` varchar(96),
	`landCategory` varchar(64),
	`officialAreaSqm` varchar(32),
	`boundaryGeoJson` text,
	`sourceProvider` varchar(64) NOT NULL,
	`sourceLayer` varchar(128) NOT NULL,
	`sourceUrl` text,
	`sourceUpdatedAt` varchar(64),
	`parcelSelectionMethod` enum('map_click','drawn_boundary','manual_pnu') NOT NULL,
	`selectedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `siteParcels_id` PRIMARY KEY(`id`),
	CONSTRAINT `siteParcels_projectId_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
ALTER TABLE `analysisSnapshots` MODIFY COLUMN `analysisCategory` enum('parcel','regulation','environment','transport','parking','facility','commerce','park','demographics','terrain','building','culture','manual') NOT NULL;