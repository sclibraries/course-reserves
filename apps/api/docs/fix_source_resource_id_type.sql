-- Fix source_resource_id column type to handle FOLIO UUIDs
-- The column needs to be VARCHAR(255) to store UUID strings like:
-- '4b806e24-3758-5328-9e62-0719edce4a10'

USE reserves;

-- Check current column type
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    COLUMN_TYPE
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'reserves' 
    AND TABLE_NAME = 'submission_new_resources' 
    AND COLUMN_NAME = 'source_resource_id';

-- Alter the column to VARCHAR(255)
ALTER TABLE submission_new_resources 
MODIFY COLUMN source_resource_id VARCHAR(255) NULL;

-- Verify the change
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    COLUMN_TYPE
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'reserves' 
    AND TABLE_NAME = 'submission_new_resources' 
    AND COLUMN_NAME = 'source_resource_id';

-- Expected output:
-- COLUMN_NAME: source_resource_id
-- DATA_TYPE: varchar
-- CHARACTER_MAXIMUM_LENGTH: 255
-- COLUMN_TYPE: varchar(255)
