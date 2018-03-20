browser.contextMenus.create({
  id: "replace-all-in-tabs",
  title: "Replace All In Tabs",
  contexts: ["bookmark"],
});

var oldTabs;
var leaves = 0;

function createAndRemoveOldTabs(children) {
    createTabs(children);
    // only remove if we opened at least one new tab, or the window will close
    if (leaves>0)
	browser.tabs.remove(oldTabs);
}

function createTabs(children) {
    for (child of children) {
	if (child.url != null) {
	    browser.tabs.create({ url:child.url });
	    leaves++;
	} else {
	    // recurse
	    browser.bookmarks.getChildren(child.id).then(createTabs);
	}
    }
}

function replaceAllInTabs(id) {
    browser.tabs.query({ currentWindow:true }).then(
	function(tabs) {
	    oldTabs = tabs.map(function(a) { return a.id; });
	    browser.bookmarks.getChildren(id).then(createAndRemoveOldTabs);
	}
    );
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "replace-all-in-tabs":
	replaceAllInTabs(info.bookmarkId);
	break;
  }
});
