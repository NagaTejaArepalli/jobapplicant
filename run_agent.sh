#!/usr/bin/env bash
set -e

# AI SDET Job Applier - Unix / Mac / Linux Runner
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "  Starting AI SDET Job Applier Agent"
echo "  Time: $(date)"
echo "========================================================"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not found on PATH. Please install Node.js."
    exit 1
fi

echo ""
echo "[1/2] Discovering & Applying to QA/SDET Roles..."
npx ts-node src/applyAgent.ts

echo ""
echo "[2/2] Generating and Dispatching Consolidated Email Report..."
npx ts-node src/sendEmailReport.ts

echo ""
echo "========================================================"
echo "  Agent execution completed successfully!"
echo "========================================================"
