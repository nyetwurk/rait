browser.contextMenus.create({
  id: "replace-all-in-tabs",
  title: "Replace All In Tabs",
  contexts: ["bookmark"],
});

var oldTabs

function createAndRemoveOldTabs(children) {
    for (child of children) {
	browser.tabs.create({ url:child.url });
    }
    browser.tabs.remove(oldTabs);
}

function replaceAllInTabs(id) {
    var querying = browser.tabs.query({ currentWindow:true });
    querying.then(
	function(tabs) {
	    oldTabs = tabs.map(function(a) {return a.id;});
	    var getting = browser.bookmarks.getChildren(id);
	    getting.then(createAndRemoveOldTabs);
	}
    )
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "replace-all-in-tabs":
	replaceAllInTabs(info.bookmarkId);
	break;
  }
});
