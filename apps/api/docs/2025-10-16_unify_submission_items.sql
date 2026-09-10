-- Migration: Unify submission items into single table
-- Date: 2025-10-16
-- Purpose: Simplify item storage by using one table for both reuse and new items

-- Step 1: Add new columns to submission_new_resources (note: plural)
ALTER TABLE submission_new_resources 
  ADD COLUMN is_reuse TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this item is being reused from a previous submission' AFTER material_type_id,
  ADD COLUMN source_barcode VARCHAR(255) NULL COMMENT 'Barcode of item being reused' AFTER is_reuse,
  ADD COLUMN source_call_number VARCHAR(512) NULL COMMENT 'Call number of item being reused' AFTER source_barcode,
  ADD COLUMN source_resource_id BIGINT(20) UNSIGNED NULL COMMENT 'ID of resource being reused' AFTER source_call_number,
  ADD COLUMN source_folio_instance_id VARCHAR(255) NULL COMMENT 'FOLIO instance ID if available' AFTER source_resource_id,
  ADD INDEX idx_is_reuse (is_reuse),
  ADD INDEX idx_source_barcode (source_barcode),
  ADD INDEX idx_source_resource_id (source_resource_id);

-- Step 2: Add duplicate tracking to faculty_submissions
ALTER TABLE faculty_submissions
  ADD COLUMN is_duplicate_previous TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this submission duplicates a previous semester' AFTER email_confirmation_sent,
  ADD COLUMN duplicate_source_submission_id BIGINT(20) UNSIGNED NULL COMMENT 'Source submission ID being duplicated' AFTER is_duplicate_previous,
  ADD COLUMN duplicate_note TEXT NULL COMMENT 'Notes about duplication from previous semester' AFTER duplicate_source_submission_id,
  ADD INDEX idx_is_duplicate (is_duplicate_previous),
  ADD INDEX idx_duplicate_source (duplicate_source_submission_id);

-- Step 3: Migrate existing reuse items to submission_new_resources
-- This preserves all existing reuse resource data while adding full metadata
INSERT INTO submission_new_resources 
  (submission_id, material_type_id, is_reuse, source_barcode, source_call_number, 
   source_resource_id, resource_data, display_order, folder_name, position_in_folder, 
   faculty_notes, item_status, created_at, updated_at)
SELECT 
  sr.submission_id,
  COALESCE(r.material_type_id, 1) as material_type_id, -- Use resource's material type or default to book
  1 as is_reuse,
  sr.barcode as source_barcode,
  sr.call_number as source_call_number,
  sr.source_resource_id,
  -- Build full metadata JSON from resource table
  JSON_OBJECT(
    'barcode', sr.barcode,
    'callNumber', sr.call_number,
    'title', COALESCE(r.title, 'Unknown Title'),
    'authors', COALESCE(r.author, ''),
    'publisher', COALESCE(r.publisher, ''),
    'publicationYear', COALESCE(r.publication_year, ''),
    'isbn', COALESCE(r.isbn, ''),
    'edition', COALESCE(r.edition, ''),
    'materialType', COALESCE(mt.name, 'book')
  ) as resource_data,
  sr.display_order,
  sr.folder_name,
  sr.position_in_folder,
  sr.faculty_notes,
  sr.item_status,
  sr.created_at,
  sr.updated_at
FROM submission_reuse_resources sr
LEFT JOIN resources r ON sr.source_resource_id = r.resource_id
LEFT JOIN material_types mt ON r.material_type_id = mt.material_type_id
WHERE NOT EXISTS (
  -- Avoid duplicates if migration is run multiple times
  SELECT 1 FROM submission_new_resources snr 
  WHERE snr.submission_id = sr.submission_id 
  AND snr.source_barcode = sr.barcode
);

-- Step 4: Verify migration
SELECT 
  'Before migration' as status,
  (SELECT COUNT(*) FROM submission_reuse_resources) as reuse_count,
  (SELECT COUNT(*) FROM submission_new_resources WHERE is_reuse = 0) as new_count,
  (SELECT COUNT(*) FROM submission_new_resources WHERE is_reuse = 1) as migrated_reuse_count
UNION ALL
SELECT 
  'Expected after migration' as status,
  (SELECT COUNT(*) FROM submission_reuse_resources) as original_reuse,
  (SELECT COUNT(*) FROM submission_new_resources WHERE is_reuse = 0) as new_items,
  (SELECT COUNT(*) FROM submission_reuse_resources) as should_match;

-- Step 5: Create backup before dropping old table
-- RUN THIS MANUALLY AFTER VERIFYING STEP 4:
-- CREATE TABLE submission_reuse_resources_backup_20251016 AS SELECT * FROM submission_reuse_resources;
-- DROP TABLE submission_reuse_resources;

-- Optional: Rename table for clarity (run after testing)
-- ALTER TABLE submission_new_resources RENAME TO submission_items;
