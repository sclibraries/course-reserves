-- Migration: Add Link Visibility Fields  
-- Description: Adds individual visibility date fields to the resource_links table to support
--              link-level visibility control, and primary link visibility control to resources table

-- Add visibility fields to the resource_links table
ALTER TABLE resource_links 
ADD COLUMN start_visibility DATE NULL COMMENT 'When this specific link becomes visible to students',
ADD COLUMN end_visibility DATE NULL COMMENT 'When this specific link stops being visible to students',
ADD COLUMN use_link_visibility BOOLEAN DEFAULT FALSE COMMENT 'Whether this link uses individual visibility dates';

-- Add index for visibility date queries (for performance)
CREATE INDEX idx_resource_links_visibility ON resource_links (start_visibility, end_visibility, use_link_visibility);

-- Add primary link visibility fields to resources table
ALTER TABLE resources 
ADD COLUMN use_primary_link_visibility TINYINT(1) DEFAULT 0 COMMENT 'Whether primary link has separate visibility control',
ADD COLUMN primary_link_start_visibility DATE NULL COMMENT 'When primary link becomes visible to students',
ADD COLUMN primary_link_end_visibility DATE NULL COMMENT 'When primary link stops being visible to students';
