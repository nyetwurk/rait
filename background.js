browser.contextMenus.create({
    id: "replace-all-in-tabs",
    title: "Replace All In Tabs",
    contexts: ["bookmark"]
});

var storedOptions;

function tabUpdateOrCreate(id, prop, activate) {
    let finalProp = {...prop}; // Copy properties
    // Only explicitly set 'active' if the option is enabled.
    // Otherwise, let the browser decide the default active state.
    // We check storedOptions here as it's simpler than passing the boolean down.
    if (storedOptions.includes("activateFirstTab")) {
        finalProp.active = activate;
    }
    if (id!=null)
	return browser.tabs.update(id, finalProp);
    return browser.tabs.create(finalProp);
}

function updateAndRemoveOldTabs(oldTabs, bookmarks, recurseTasks, updateTasks) {
    let isFirstUrlRef = { value: true }; // Ref object to track first URL encounter
    /* gather recurseTasks and updateTasks */
    recurseBookmarks(oldTabs, bookmarks, recurseTasks, updateTasks, isFirstUrlRef); // Pass the ref
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
	    for (err of errs) {
		let id = err.tab.id;
		let url = err.url;
                // Pass error info via URL hash
                let errorPageUrl = `/error.html#url=${encodeURIComponent(url)}&isNew=${id == null}`;
		tabUpdateOrCreate(id, { url: errorPageUrl }, false) // Ensure error pages aren't activated
		.then (tab => {
		    console.log(`Not permitted to load "${url}" in tab #${tab.id}`);
		    // No longer need to populate errMap here
		})
                .catch(e => console.error(`Failed to open error page for ${url}:`, e)); // Add catch for error page update failure
	    }
	});
    });
}

/* Give a promise return values and add it to the task list */
function loadTab(promise, id, url, updateTasks)
{
    updateTasks.push(
	promise.then(
	    tab => {return {ok:true, tab:tab, url:url}},
	    e => {return {ok:false, tab:{id:id}, url:url, err:e.message}}
	)
    );
}

/* recursively generate list of old tabs and bookmark loading promises */
function recurseBookmarks(oldTabs, bookmarks, recurseTasks, updateTasks, isFirstUrlRef) {
    for (child of bookmarks) {
	if (child.url != null) {
	    let id = (oldTabs.length>0)?oldTabs.shift():null;
            // Determine if this tab should be activated
            let activate = false;
            if (storedOptions.includes("activateFirstTab") && isFirstUrlRef.value) {
                activate = true;
                isFirstUrlRef.value = false; // Mark first URL as processed
            }
	    let p = tabUpdateOrCreate(id, { url: child.url }, activate); // Pass activate flag
	    loadTab(p, id, child.url, updateTasks); // Pass updateTasks
	} else {
	    /* recurse if enabled */
	    if (storedOptions.includes("recurse")) {
		let getting =
		    browser.bookmarks.getChildren(child.id)
		    // Pass tasks and ref down during recursion
		    .then(newBookmarks => recurseBookmarks(oldTabs, newBookmarks, recurseTasks, updateTasks, isFirstUrlRef))
		recurseTasks.push(getting);
	    }
	}
    }
}

function replaceAllInTabs(id) {
    // Initialize state locally for this invocation
    let recurseTasks = [];
    let updateTasks = [];
    // errMap is no longer needed here or globally

    browser.storage.local.get()
    .then(options => {
	/* copy options */
	// Assuming 'options' structure is { options: [...] } based on original code
        storedOptions = options.options || []; // Ensure storedOptions is an array
	/* grab bookmarks of this bookmark id */
	let bookmarkPromise = browser.bookmarks.getChildren(id);
	/* grab current open tabs */
	browser.tabs.query({ currentWindow:true })
	.then(tabs => {
	    /* extract array of tab ids */
	    let tabIds = tabs.map(a => a.id);
	    /* traverse bookmarks, passing local state */
	    bookmarkPromise.then(bms => updateAndRemoveOldTabs(tabIds, bms, recurseTasks, updateTasks))
                         .catch(e => console.error("Error processing bookmarks:", e)); // Add error handling for bookmark processing
	})
        .catch(e => console.error("Error querying tabs:", e)); // Add error handling for tab query
    })
    .catch(e => console.error("Error getting storage:", e)); // Add error handling for storage access
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "replace-all-in-tabs":
	replaceAllInTabs(info.bookmarkId);
	break;
  }
});
