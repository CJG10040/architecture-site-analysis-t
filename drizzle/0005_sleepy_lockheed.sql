CREATE TABLE `cadastralImports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`districtCode` varchar(16) NOT NULL,
	`districtName` varchar(80) NOT NULL,
	`datasetReference` varchar(32) NOT NULL,
	`sourceFileName` varchar(255) NOT NULL,
	`sourceFileKey` text,
	`sourceFileUrl` text,
	`sha256` varchar(64) NOT NULL,
	`featureCount` int NOT NULL DEFAULT 0,
	`coordinateReference` varchar(120),
	`cadastralImportStatus` enum('processing','active','superseded','failed') NOT NULL DEFAULT 'processing',
	`safeError` varchar(280),
	`importedBy` int,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cadastralImports_id` PRIMARY KEY(`id`),
	CONSTRAINT `cadastralImports_district_reference` UNIQUE(`districtCode`,`datasetReference`)
);
--> statement-breakpoint
CREATE TABLE `cadastralParcels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importId` int NOT NULL,
	`pnu` varchar(32) NOT NULL,
	`jibun` varchar(96),
	`landIndicator` varchar(16),
	`localAdminCode` varchar(16),
	`minLongitude` double NOT NULL,
	`minLatitude` double NOT NULL,
	`maxLongitude` double NOT NULL,
	`maxLatitude` double NOT NULL,
	`geometryGzipBase64` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cadastralParcels_id` PRIMARY KEY(`id`),
	CONSTRAINT `cadastralParcels_import_pnu` UNIQUE(`importId`,`pnu`)
);
--> statement-breakpoint
CREATE INDEX `cadastralParcels_bbox` ON `cadastralParcels` (`minLongitude`,`maxLongitude`,`minLatitude`,`maxLatitude`);--> statement-breakpoint
CREATE INDEX `cadastralParcels_pnu` ON `cadastralParcels` (`pnu`);