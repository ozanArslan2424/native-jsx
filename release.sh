#!/usr/bin/env zsh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'
STEP=0

next() {
    STEP=$((STEP + 1))
}

pause() {
    echo ""
    echo -e "${YELLOW}$1${RESET}"
    echo -e "Press any key to continue, or Ctrl+C to abort..."
    read -rsk 1
    echo ""
    next
}

echo -e "${GREEN}=== Release Script ===${RESET}"

# Login
if pnpm whoami &>/dev/null; then
    echo -e "${GREEN}Step ${STEP}: Already logged in as $(pnpm whoami), skipping...${RESET}"
    next
else
    echo -e "${GREEN}Step ${STEP}: Running pnpm login...${RESET}"
    pnpm login
    pause "Step ${STEP} complete. Ready to create a changeset?"
fi

# Changeset (interactive — waits for CLI to finish naturally)
echo -e "${GREEN}Step ${STEP}: Running pnpm run changeset...${RESET}"
pnpm run changeset
pause "Step ${STEP} complete. Ready to version packages?"

# Version
echo -e "${GREEN}Step ${STEP}: Running pnpm run version...${RESET}"
pnpm run version
pause "Step ${STEP} complete. Review the version bump and changelog, then commit?"

# Commit
VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Step ${STEP}: Committing v${VERSION}...${RESET}"
git add -A
git commit -m "v${VERSION}"
pause "Step ${STEP} complete. Ready to publish?"

# Release
echo -e "${GREEN}Step ${STEP}: Running pnpm run release...${RESET}"
pnpm run release

# Push
echo -e "${GREEN}Step ${STEP}: Pushing commit and tags...${RESET}"
git push --follow-tags
echo -e "${GREEN}=== Release complete ===${RESET}"
