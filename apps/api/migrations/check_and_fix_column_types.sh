#!/bin/bash

# Script to verify and fix source_resource_id column type
# This column must be VARCHAR(255) to store FOLIO UUID strings

echo "=== Checking source_resource_id Column Type ==="
echo ""

# Check current type
echo "Current column definition:"
mysql reserves -e "
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    COLUMN_TYPE,
    IS_NULLABLE
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'reserves' 
    AND TABLE_NAME = 'submission_new_resources' 
    AND COLUMN_NAME = 'source_resource_id';
" --table

echo ""
echo "Expected: DATA_TYPE = varchar, CHARACTER_MAXIMUM_LENGTH = 255"
echo ""

# Ask if user wants to fix it
read -p "Do you want to change it to VARCHAR(255)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Applying fix..."
    mysql reserves -e "ALTER TABLE submission_new_resources MODIFY COLUMN source_resource_id VARCHAR(255) NULL;"
    
    if [ $? -eq 0 ]; then
        echo "✅ Column updated successfully!"
        echo ""
        echo "Verifying change:"
        mysql reserves -e "
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
        " --table
    else
        echo "❌ Failed to update column"
    fi
else
    echo "Skipped column update"
fi

echo ""
echo "=== Also checking related columns ==="
mysql reserves -e "
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
    AND COLUMN_NAME IN (
        'source_barcode', 
        'source_call_number', 
        'source_resource_id', 
        'source_folio_instance_id',
        'is_reuse'
    )
ORDER BY COLUMN_NAME;
" --table

echo ""
echo "Expected column types:"
echo "  is_reuse                    : tinyint(1)"
echo "  source_barcode              : varchar(255)"
echo "  source_call_number          : varchar(512)"
echo "  source_resource_id          : varchar(255)"
echo "  source_folio_instance_id    : varchar(255)"
