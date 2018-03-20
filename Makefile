VERSION = $(shell grep \"version\": manifest.json  | cut -f 4 -d \")
FILES = LICENSE manifest.json background.js icons/rait.svg
ReplaceAllInTabs-${VERSION}.xpi: ${FILES}
	zip $@ ${FILES}
