VERSION = $(shell grep \"version\": manifest.json | cut -f 4 -d \")

FILES = LICENSE README.md manifest.json background.js error.html error.js \
	options/options.css options/options.html options/options.js \
        $(wildcard icons/*.svg icons/*.png)

ReplaceAllInTabs-${VERSION}.xpi: Makefile ${FILES}
	zip $@ ${FILES}
