VERSION = $(shell jq -r '.version_name' manifest.json)

FILES = LICENSE README.md manifest.json background.js browser-polyfill.js error.html error.js \
	options/options.css options/options.html options/options.js \
        $(wildcard icons/*.svg icons/*.png)

ReplaceAllInTabs-${VERSION}.xpi: Makefile ${FILES}
	zip $@ ${FILES}
