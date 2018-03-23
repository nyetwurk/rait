VERSION = $(shell grep \"version\": manifest.json | cut -f 4 -d \")

FILES = LICENSE README.md manifest.json background.js icons/rait.svg \
	options/options.css options/options.html options/options.js

ReplaceAllInTabs-${VERSION}.xpi: Makefile ${FILES}
	zip $@ ${FILES}
