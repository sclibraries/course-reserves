#!/bin/bash

# Simple case-sensitivity checker for common import issues
# Run this before deploying to catch case-sensitivity issues

echo "🔍 Checking for potential case-sensitivity issues..."

# Check for specific known problematic patterns
issues_found=0

echo "Checking for specific case-sensitivity issues..."

# Check for CustomToolTip vs CustomTooltip inconsistencies
if grep -r "CustomToolTip" src/; then
    echo "❌ Error: Found CustomToolTip (capital T) - should be CustomTooltip (lowercase t)"
    issues_found=1
fi

# Check for other common patterns you might want to watch for
# Add more specific patterns here as needed

if [ $issues_found -eq 0 ]; then
    echo "✅ No case-sensitivity issues found"
    exit 0
else
    echo "❌ Case-sensitivity issues detected. Please fix before deployment."
    exit 1
fi
