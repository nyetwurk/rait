VERSION = $(shell grep \"version\": manifest.json | cut -f 4 -d \")

FILES = LICENSE manifest.json background.js icons/rait.svg \
	options/options.css options/options.html options/options.js

ReplaceAllInTabs-${VERSION}.xpi: ${FILES}
	zip $@ ${FILES}
