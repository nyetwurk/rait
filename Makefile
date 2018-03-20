VERSION = $(shell grep \"version\": manifest.json  | cut -f 4 -d \")
ReplaceAllInTabs-${VERSION}.xpi:
	zip $@ LICENSE manifest.json background.js
