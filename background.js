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

async function updateAndRemoveOldTabs(oldTabIds, bookmarks, recurseTasks, updateTasks) {
    // oldTabIds is now the array of IDs again
    let isFirstUrlRef = { value: true };

    // Start populating tasks (synchronous)
    recurseBookmarks(oldTabIds, bookmarks, recurseTasks, updateTasks, isFirstUrlRef);

    try {
        // Wait for recursive bookmark loading tasks to complete
        await Promise.all(recurseTasks);

        // Wait for all tab update/create tasks to attempt completion
        const arrayOfResults = await Promise.all(updateTasks);

        /* Process results */
        let ok = arrayOfResults.filter(v => v.ok);

        // Close other tabs based on the original list of IDs
        if (storedOptions.includes("closeOtherTabs") && ok.length > 0 && oldTabIds.length > 0) {
            // Directly remove the original tab IDs
            try {
                await browser.tabs.remove(oldTabIds);
                console.log("Removed old tabs:", oldTabIds);
            } catch (e) {
                console.error("Error removing old tabs:", e);
            }
        }

        let errs = arrayOfResults.filter(v => !v.ok);
        for (const err of errs) {
            let id = err.tab.id;
            let url = err.url;
            let errorPageUrl = `/error.html#url=${encodeURIComponent(url)}&isNew=${id == null}`;
            try {
                // Await the update/create for the error page
                const tab = await tabUpdateOrCreate(id, { url: errorPageUrl }, false);
                console.log(`Redirected tab #${tab.id} to error page for restricted URL: "${url}"`);
            } catch (e) {
                console.error(`Failed to open error page for ${url}:`, e);
            }
        }
    } catch (e) {
        // Catch errors from Promise.all itself
        console.error("Error processing tab updates or bookmark recursion:", e);
    }
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
function recurseBookmarks(oldTabIds, bookmarks, recurseTasks, updateTasks, isFirstUrlRef) {
    for (const child of bookmarks) {
        if (child.url != null) {
            // Get tab ID to update/reuse, or null if creating new
            let id = (oldTabIds.length > 0) ? oldTabIds.shift() : null;

            let activate = false;
            if (storedOptions.includes("activateFirstTab") && isFirstUrlRef.value) {
                activate = true;
                isFirstUrlRef.value = false;
            }
            // tabUpdateOrCreate returns a promise
            let p = tabUpdateOrCreate(id, { url: child.url }, activate);
            // loadTab wraps it and pushes onto updateTasks
            loadTab(p, id, child.url, updateTasks);
        } else {
            if (storedOptions.includes("recurse")) {
                // Push the promise chain for getting children and recursing
                let getting = browser.bookmarks.getChildren(child.id)
                    .then(newBookmarks => recurseBookmarks(oldTabIds, newBookmarks, recurseTasks, updateTasks, isFirstUrlRef)); // Pass oldTabIds
                recurseTasks.push(getting);
            }
        }
    }
}

async function replaceAllInTabs(id) {
    let recurseTasks = [];
    let updateTasks = [];

    try {
        // Use await for storage access
        const options = await browser.storage.local.get();
        storedOptions = options.options || []; // Revert default logic

        // Use await for bookmarks and tabs query (can run in parallel)
        const [bms, tabs] = await Promise.all([
            browser.bookmarks.getChildren(id),
            browser.tabs.query({ currentWindow: true })
        ]);
        
        // Extract tab IDs again
        let tabIds = tabs.map(a => a.id);
        
        // Pass the tab IDs array to updateAndRemoveOldTabs
        await updateAndRemoveOldTabs(tabIds, bms, recurseTasks, updateTasks);

    } catch (e) {
        // Catch errors from storage, bookmarks, tabs query, or updateAndRemoveOldTabs
        console.error("Error during replaceAllInTabs execution:", e);
    }
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "replace-all-in-tabs":
	replaceAllInTabs(info.bookmarkId);
	break;
  }
});
