browser.contextMenus.create({
  id: "replace-all-in-tabs",
  title: "Replace All In Tabs",
  contexts: ["bookmark"],
});

var storedOptions;
var oldTabs;
var leaves;

function updateAndRemoveOldTabs(children) {
    leaves = 0;
    updateTabList(children);
    // remove leftover tabs, but only if we made new tabs, otherwise
    // there will be nothing left and the window will close.
    if (storedOptions.indexOf("closeOtherTabs") != -1 &&
        leaves>0 && oldTabs.length>0) {
	browser.tabs.remove(oldTabs);
    }
}

function updateTabList(children) {
    for (child of children) {
	if (child.url != null) {
	    if (oldTabs.length>0) {
		// update existing tab
	        browser.tabs.update(oldTabs.shift(), { url:child.url })
	    } else {
		// make new tab
		browser.tabs.create({ url:child.url });
	    }
	    leaves++;
	} else {
	    // recurse if enabled.
	    if (storedOptions.indexOf("recurse") != -1)
		browser.bookmarks.getChildren(child.id).then(updateTabList);
	}
    }
}

function replaceAllInTabs(id) {
    browser.storage.local.get().then(options => {
	storedOptions = options.options;
	browser.tabs.query({ currentWindow:true }).then(
	    function(tabs) {
		oldTabs = tabs.map(function(a) { return a.id; });
		browser.bookmarks.getChildren(id).then(updateAndRemoveOldTabs);
	    }
	);
    });
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "replace-all-in-tabs":
	replaceAllInTabs(info.bookmarkId);
	break;
  }
});
