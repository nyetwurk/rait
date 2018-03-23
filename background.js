browser.contextMenus.create({
  id: "replace-all-in-tabs",
  title: "Replace All In Tabs",
  contexts: ["bookmark"],
});

var storedOptions;
var oldTabs;
var tasks;
var recurseTasks;

function showError(title, error)
{
    let window = `window.alert("${title}\\n\\n${error}");`;
    browser.tabs.executeScript({code: window});
}

function updateAndRemoveOldTabs(children) {
    tasks = [];
    recurseTasks = [];
    updateBookmarks(children);
    /* traverse recursed tab list to fill flat oldTabs list */
    Promise.all(recurseTasks).then(function() {
	/* traverse tabs to be opened */
	Promise.all(tasks).then(arrayOfResults => {
	    // get list of successes
	    let ok = arrayOfResults.filter(v => v.ok);
	    // remove leftover tabs, but only if we have new tabs, otherwise
	    // there will be nothing left and the window will close.
	    if (storedOptions.indexOf("closeOtherTabs") != -1 &&
		ok.length>0 && oldTabs.length>0) {
		browser.tabs.remove(oldTabs);
	    }
	    // get list of failures
	    let errs = arrayOfResults.map(v => v.err).filter(Boolean);
	    if (errs.length>0)
		showError("Could not load bookmark(s):", errs.join('\\n'));
	});
    });
}

/* Give a promise return values and add it to the task list */
function loadTab(promise)
{
    tasks.push(
	promise.then(
	    tab => {return {ok:true}},
	    e => {return {ok:false, err:e.message}}
	)
    );
}

/* recursively generate list of old tabs and bookmark loading promises */
function updateBookmarks(children) {
    for (child of children) {
	if (child.url != null) {
	    let url = { url:child.url };
	    if (oldTabs.length>0) {
		// update existing tab
		loadTab(browser.tabs.update(oldTabs.shift(), url))
	    } else {
		// make new tab
		loadTab(browser.tabs.create(url));
	    }
	} else {
	    // recurse if enabled.
	    if (storedOptions.indexOf("recurse") != -1)
		recurseTasks.push(browser.bookmarks.getChildren(child.id)
		    .then(updateBookmarks));
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
