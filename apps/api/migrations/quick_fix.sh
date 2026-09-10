#!/bin/bash
# Quick fix for source_resource_id column type
# Run this: ./quick_fix.sh

echo "Fixing source_resource_id column type..."
mysql reserves -e "ALTER TABLE submission_new_resources MODIFY COLUMN source_resource_id VARCHAR(255) NULL;" && echo "✅ Fixed! Column is now VARCHAR(255)" || echo "❌ Failed - check permissions"
