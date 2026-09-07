ALTER TABLE `work_items` ADD `section` text DEFAULT 'Other works' NOT NULL;--> statement-breakpoint
CREATE INDEX `work_items_company_section_idx` ON `work_items` (`company_id`,`section`);