SHELL=/bin/bash

VERSION = $(shell jq -r '.version_name' manifest.json)

FILES = LICENSE README.md manifest.json background.js browser-polyfill.js error.html error.js \
	options/options.css options/options.html options/options.js \
        $(wildcard icons/*.svg icons/*.png)

# Define package.json as a target file depending on manifest.json
# This recipe only runs if manifest.json is newer than package.json
package.json: manifest.json
	@echo "Manifest newer than package.json. Syncing version ($(VERSION))..."
	jq --arg new_version "$(VERSION)" '.version = $$new_version' $@ > $@.tmp && mv $@.tmp $@

# Phony targets (commands, not files)
.PHONY: all xpi lint clean-tag release

all: lint
xpi: ReplaceAllInTabs-${VERSION}.xpi

# Build the XPI package
ReplaceAllInTabs-${VERSION}.xpi: Makefile ${FILES}
	zip $@ ${FILES}

# Lint the code (depends on package.json being up-to-date)
lint: package.json
	@echo "Installing Node dependencies (if needed)..."
	npm install
	@echo "Running linter..."
	npm run lint

# Clean tag (depends on package.json being up-to-date)
clean-tag: package.json
	@echo "Checking for uncommitted changes..."
	@# This check should now only fail if other manual changes were made,
	@# or if package.json was *actually* just updated by the rule above.
	@git diff-index --quiet HEAD -- || (echo "ERROR: Uncommitted changes found. Please commit or stash them." && exit 1)

	@echo "Fetching remote info (master and tags)..."
	@git fetch origin master --tags --quiet

	@echo "Checking if local tag v$(VERSION) is part of origin/master history..."
	@LOCAL_TAG_COMMIT=$$(git rev-parse v$(VERSION)^{commit} 2>/dev/null); \
	if [ $$? -eq 0 ]; then \
	    if git merge-base --is-ancestor $$LOCAL_TAG_COMMIT origin/master; then \
	        echo "ERROR: Local tag v$(VERSION) (commit $$LOCAL_TAG_COMMIT) is part of origin/master history. Aborting clean-tag." ; \
	        exit 1 ; \
	    else \
	        echo "Local tag v$(VERSION) OK (not ancestor)." ; \
	    fi; \
	else \
	    echo "Local tag v$(VERSION) does not exist. Safe to proceed."; \
	fi

	@echo "Cleaning local tag v$(VERSION) (if exists)..."
	git tag -d v$(VERSION) || true
	@echo "Cleaning remote tag v$(VERSION) (if exists)..."
	git push origin :refs/tags/v$(VERSION) || true

release: clean-tag
	@echo "Creating release tag v$(VERSION)..."
	git tag -a v$(VERSION) -m "Release $(VERSION)"
	@echo "Pushing master and tag v$(VERSION)..."
	git push origin
	git push origin v$(VERSION)
