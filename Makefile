VERSION = $(shell jq -r '.version_name' manifest.json)

FILES = LICENSE README.md manifest.json background.js browser-polyfill.js error.html error.js \
	options/options.css options/options.html options/options.js \
        $(wildcard icons/*.svg icons/*.png)

.PHONY: all xpi
all: lint
xpi: ReplaceAllInTabs-${VERSION}.xpi

# Build the XPI package
ReplaceAllInTabs-${VERSION}.xpi: Makefile ${FILES}
	zip $@ ${FILES}

.PHONY: lint clean-tag tag
# Lint the code
# Updates package.json version, ensures dependencies are installed, then lints
lint:
	@echo "Syncing package.json version ($(VERSION)) from manifest.json..."
	jq --arg new_version "$(VERSION)" '.version = $$new_version' package.json > package.json.tmp && mv package.json.tmp package.json
	@echo "Installing Node dependencies (if needed)..."
	npm install
	@echo "Running linter..."
	npm run lint

clean-tag:
	git tag -d v$(VERSION) || true
	git push origin :refs/tags/v$(VERSION) || true

tag: clean-tag
	git tag -a v$(VERSION) -m "Release $(VERSION)"
	git push origin
	git push origin v$(VERSION)
