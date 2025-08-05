-- Migration: Cleanup Visibility Mode
-- Description: Remove the visibility_mode field from resources table since we simplified
--              to use only primary link visibility control instead

-- Remove the visibility_mode column that is no longer needed
ALTER TABLE resources DROP COLUMN visibility_mode;
