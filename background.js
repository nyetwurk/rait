window.browser = (function () {
    return window.msBrowser || window.browser || window.chrome;
})();

browser.contextMenus.create({
    id: "replace-all-in-tabs",
    title: "Replace All In Tabs",
    contexts: ["bookmark"]	// does not work in chrome, of course.
});

var storedOptions;
var recurseTasks;
var updateTasks;

function showError(title, error)
{
    let window = `window.alert("${title}\\n\\n${error}");`;
    browser.tabs.executeScript({code: window});
}

function updateAndRemoveOldTabs(oldTabs, bookmarks) {
    recurseTasks = [];
    updateTasks = [];
    /* gather recurseTasks and updateTasks */
    recurseBookmarks(oldTabs, bookmarks);
    /* traverse bookmark list */
    Promise.all(recurseTasks)
    .then(function() {
	/* traverse existing tabs, possibly to be updated */
	Promise.all(updateTasks)
        .then(arrayOfResults => {
	    /* get list of successes */
	    let ok = arrayOfResults.filter(v => v.ok);
	    // remove leftover tabs, but only if we have new tabs, otherwise
	    // there will be nothing left and the window will close.
	    if (storedOptions.indexOf("closeOtherTabs") != -1 &&
		ok.length>0 && oldTabs.length>0) {
		browser.tabs.remove(oldTabs);
	    }
	    /* get list of failures */
	    let errs = arrayOfResults.map(v => v.err).filter(Boolean);
	    if (errs.length>0)
		showError("Could not load bookmark(s):", errs.join('\\n'));
	});
    });
}

/* Give a promise return values and add it to the task list */
function loadTab(promise)
{
    updateTasks.push(
	promise.then(
	    tab => {return {ok:true}},
	    e => {return {ok:false, err:e.message}}
	)
    );
}

/* recursively generate list of old tabs and bookmark loading promises */
function recurseBookmarks(oldTabs, bookmarks) {
    for (child of bookmarks) {
	if (child.url != null) {
	    let url = { url:child.url };
	    if (oldTabs.length>0) {
		/* update existing tab */
		loadTab(browser.tabs.update(oldTabs.shift(), url))
	    } else {
		/* make new tab */
		loadTab(browser.tabs.create(url));
	    }
	} else {
	    /* recurse if enabled */
	    if (storedOptions.indexOf("recurse") != -1) {
		let getting =
		    browser.bookmarks.getChildren(child.id)
		    .then(bookmarks => recurseBookmarks(oldTabs, bookmarks))
		recurseTasks.push(getting);
	    }
	}
    }
}

function replaceAllInTabs(id) {
    browser.storage.local.get()
    .then(options => {
	/* copy options */
	storedOptions = options.options;
	/* grab bookmarks of this bookmark id */
	bookmarkPromise = browser.bookmarks.getChildren(id);
	/* grab current open tabs */
	browser.tabs.query({ currentWindow:true })
	.then(tabs => {
	    /* extract array of tab ids */
	    let tabIds = tabs.map(a => a.id);
	    /* traverse bookmarks */
	    bookmarkPromise.then(bms => updateAndRemoveOldTabs(tabIds, bms))
	});
    });
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "replace-all-in-tabs":
	replaceAllInTabs(info.bookmarkId);
	break;
  }
});
