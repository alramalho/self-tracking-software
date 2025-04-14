#!/bin/bash

# Script to migrate data from production to development tables for Tracking Software
# Now using the aws-utils Python commands directly

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color

# Tables to migrate (prod to dev)
TABLES=(
    "tracking_software_activities"
    "tracking_software_activity_entries"
    "tracking_software_friend_requests"
    "tracking_software_messages"
    "tracking_software_metric_entries"
    "tracking_software_metrics"
    "tracking_software_mood_reports"
    "tracking_software_notifications"
    "tracking_software_plan_groups"
    "tracking_software_plan_invitations"
    "tracking_software_plans"
    "tracking_software_users"
)

# Primary key for all tables
PRIMARY_KEY="id"

# Function to display a step message
echo_step() {
    echo -e "${YELLOW}[STEP]${NC} $1"
}

# Function to display a success message
echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to display a warning message
echo_warning() {
    echo -e "${ORANGE}[WARNING]${NC} $1"
}

# Function to display an error message and exit
echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check for force flag
FORCE_FLAG=""
if [[ "$1" == "--force" ]]; then
    FORCE_FLAG="--force"
fi

# Confirm before proceeding if not forced
if [[ -z "$FORCE_FLAG" ]]; then
    echo -e "${RED}WARNING: This script will WIPE ALL DATA from the development tables and replace it with production data.${NC}"
    echo -e "Tables that will be affected:"
    for table in "${TABLES[@]}"; do
        echo "  - ${table}_dev (will be wiped and replaced)"
        echo "  - ${table}_production (source data)"
    done

    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Migration cancelled."
        exit 0
    fi
fi

# Track overall status
warnings=0
wipe_warnings=0

# Wipe all dev tables first
echo_step "Wiping all development tables..."
for table in "${TABLES[@]}"; do
    dev_table="${table}_dev"
    echo "  Wiping $dev_table..."
    
    # Get the wipe result with detailed counts
    wipe_output=$(aws-wipe-table -t "$dev_table" --force --pk "$PRIMARY_KEY")
    wipe_status=$?
    
    echo "    $wipe_output"
    
    if [[ $wipe_status -ne 0 ]]; then
        echo_error "Failed to wipe $dev_table"
    fi
    
    # Check if there was a warning in the wipe output
    if [[ $wipe_output == *"Warning"* ]]; then
        wipe_warnings=$((wipe_warnings+1))
    fi
done

if [[ $wipe_warnings -gt 0 ]]; then
    echo_warning "Completed wiping tables with $wipe_warnings warnings"
else
    echo_success "All development tables wiped successfully"
fi

# Migrate data from prod to dev tables
echo_step "Migrating data from production to development tables..."
for table in "${TABLES[@]}"; do
    prod_table="${table}_production"
    dev_table="${table}_dev"
    
    # Get production table count first
    echo "  Getting count from $prod_table..."
    prod_count=$(aws-scan-table -t "$prod_table" | grep "Number of items fetched:" | awk '{print $5}')
    echo "    - $prod_table: $prod_count items"
    
    # Migrate the data
    echo "  Migrating $prod_table → $dev_table..."
    aws-migrate-table -s "$prod_table" -d "$dev_table" || echo_error "Failed to migrate $prod_table to $dev_table"
    
    # Verify migration by checking item counts
    echo "  Verifying migration..."
    dev_count=$(aws-scan-table -t "$dev_table" | grep "Number of items fetched:" | awk '{print $5}')
    echo "    - $dev_table: $dev_count items"
    
    if [ "$prod_count" != "$dev_count" ]; then
        echo_warning "Item count mismatch between $prod_table ($prod_count) and $dev_table ($dev_count)!"
        warnings=$((warnings+1))
    else
        echo "    ✅ Counts match"
    fi
done

# Print overall summary
if [ $warnings -gt 0 ] || [ $wipe_warnings -gt 0 ]; then
    echo -e "\n${ORANGE}Migration completed with warnings:${NC}"
    [ $wipe_warnings -gt 0 ] && echo "  - $wipe_warnings table wipe warnings"
    [ $warnings -gt 0 ] && echo "  - $warnings migration count mismatch warnings"
    echo "Please check the output above for details."
else
    echo_success "Migration completed successfully with no warnings!"
fi

echo "All Tracking Software production data has been migrated to development tables." 
