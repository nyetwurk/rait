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
var errMap;

function tabUpdateOrCreate(id, prop) {
    if (id!=null)
	return browser.tabs.update(id, prop);
    return browser.tabs.create(prop);
}

function updateAndRemoveOldTabs(oldTabs, bookmarks) {
    recurseTasks = [];
    updateTasks = [];
    errMap = [];
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
	    let errs = arrayOfResults.filter(v => !v.ok)
	    let prop = { url: "/error.html" }
	    for (err of errs) {
		let id = err.tab.id;
		let url = err.url;
		tabUpdateOrCreate(id, prop)
		.then (tab => {
		    console.log(`Not permitted to load "${url}" in tab #${tab.id}`);
		    errMap[tab.id] = { url: url, isNew: id==null };
		});
	    }
	});
    });
}

browser.runtime.onMessage.addListener(function(req, sender, resp) {
    if (req.action = "getError") {
	if (errMap.indexOf[sender.tab.id] != -1)
	    resp(errMap[sender.tab.id]);
	else
	    console.log(`unknown URL for tab ${sender.tab.id}`);
    }
});

/* Give a promise return values and add it to the task list */
function loadTab(promise, id, url)
{
    updateTasks.push(
	promise.then(
	    tab => {return {ok:true, tab:tab, url:url}},
	    e => {return {ok:false, tab:{id:id}, url:url, err:e.message}}
	)
    );
}

/* recursively generate list of old tabs and bookmark loading promises */
function recurseBookmarks(oldTabs, bookmarks) {
    for (child of bookmarks) {
	if (child.url != null) {
	    let id = (oldTabs.length>0)?oldTabs.shift():null;
	    let p = tabUpdateOrCreate(id, { url: child.url });
	    loadTab(p, id, child.url);
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
