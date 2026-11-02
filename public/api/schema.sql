-- AI Metadata Remover - Stats Database Schema
-- Run this in phpMyAdmin or MySQL console in your cPanel

CREATE TABLE IF NOT EXISTS `site_stats` (
  `stat_key` VARCHAR(50) NOT NULL,
  `stat_value` BIGINT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`stat_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize default counter metrics
INSERT INTO `site_stats` (`stat_key`, `stat_value`) VALUES
  ('total_visits', 0),
  ('unique_visitors', 0),
  ('images_cleaned', 0),
  ('ai_detected_count', 0)
ON DUPLICATE KEY UPDATE `stat_key` = `stat_key`;

