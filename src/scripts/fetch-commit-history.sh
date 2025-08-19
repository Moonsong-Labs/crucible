#!/bin/bash

# Script to fetch commit history between two commits from upstream remote
# Usage: ./fetch-commit-history.sh [end_commit] [start_commit]
#        If no arguments provided, uses latest from main/master as end commit
#        If start_commit is omitted, it will be auto-detected using git merge-base

# Check if correct number of arguments provided
if [ $# -gt 2 ]; then
    echo "Usage: $0 [end_commit] [start_commit]"
    echo "       $0                    # Use latest from main as end commit"
    echo "       $0 55802ba           # Use specified end commit, auto-detect base"
    echo "       $0 1da4d32 55802ba   # Explicit base and target"
    exit 1
fi

# Handle zero, single, and double argument cases
if [ $# -eq 0 ]; then
    # No arguments - use latest from main as end commit
    if git rev-parse --verify main >/dev/null 2>&1; then
        END_COMMIT="main"
    elif git rev-parse --verify master >/dev/null 2>&1; then
        END_COMMIT="master"
    else
        echo "Error: Neither 'main' nor 'master' branch found"
        exit 1
    fi
    START_COMMIT=""  # Will be auto-detected later
elif [ $# -eq 1 ]; then
    END_COMMIT=$1
    START_COMMIT=""  # Will be auto-detected later
else
    START_COMMIT=$1
    END_COMMIT=$2
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Check if upstream remote exists
if ! git remote | grep -q "^upstream$"; then
    echo "Error: No 'upstream' remote found"
    echo "Available remotes:"
    git remote -v
    exit 1
fi

# Fetch latest from upstream
echo "Fetching latest commits from upstream..."
git fetch upstream

# Verify commits exist in upstream/master
if ! git rev-parse upstream/master~0 >/dev/null 2>&1; then
    echo "Error: upstream/master branch not found"
    exit 1
fi

# Auto-detect base commit if not provided
if [ -z "$START_COMMIT" ]; then
    echo "Auto-detecting base commit..."
    
    # First try to find merge-base with current HEAD
    START_COMMIT=$(git merge-base HEAD upstream/master 2>/dev/null)
    
    if [ -z "$START_COMMIT" ]; then
        # Fallback: try merge-base with main/master branch
        if git rev-parse --verify main >/dev/null 2>&1; then
            START_COMMIT=$(git merge-base main upstream/master 2>/dev/null)
        elif git rev-parse --verify master >/dev/null 2>&1; then
            START_COMMIT=$(git merge-base master upstream/master 2>/dev/null)
        fi
    fi
    
    if [ -z "$START_COMMIT" ]; then
        echo "Error: Could not auto-detect base commit"
        echo "Please provide explicit start commit"
        exit 1
    fi
    
    echo "Detected base commit: $(git rev-parse --short $START_COMMIT)"
fi

# Create target directory based on end commit
TARGET_DIR=".claude/upstream/${END_COMMIT}"
mkdir -p "$TARGET_DIR"

# Output file
OUTPUT_FILE="${TARGET_DIR}/commit-history.md"

# Get the full commit hashes for display
START_HASH=$(git rev-parse --short $START_COMMIT 2>/dev/null)
END_HASH=$(git rev-parse --short $END_COMMIT 2>/dev/null)

if [ -z "$START_HASH" ]; then
    echo "Error: Start commit $START_COMMIT not found"
    exit 1
fi

if [ -z "$END_HASH" ]; then
    echo "Error: End commit $END_COMMIT not found"
    exit 1
fi

# Create the commit history file
echo "Creating commit history from $START_HASH to $END_HASH..."
echo "# Commit History from $START_HASH to $END_HASH" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Get commits in chronological order (oldest to newest)
# First get the commit range
COMMITS=$(git rev-list --reverse ${START_COMMIT}..${END_COMMIT})


# Add all commits in between
for commit in $COMMITS; do
    git log -1 --pretty=format:"- %h %s" $commit >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

# Check if the file was created successfully
if [ -f "$OUTPUT_FILE" ]; then
    # Count the commits
    COMMIT_COUNT=$(grep -c "^- " "$OUTPUT_FILE")
    echo "Successfully created $OUTPUT_FILE with $COMMIT_COUNT commits"
    echo "File location: $(pwd)/$OUTPUT_FILE"
else
    echo "Error: Failed to create commit history file"
    exit 1
fi