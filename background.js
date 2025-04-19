browser.contextMenus.create({
    id: "replace-all-in-tabs",
    title: "Replace All In Tabs",
    contexts: ["bookmark"]
});

var storedOptions;

// Test URLs for error page verification
const TEST_URLS = {
    // Regular URLs
    simple: "https://example.com",
    // URLs with special characters
    specialChars: "https://example.com/path?query=value&param=test#fragment",
    // URLs with spaces
    spaces: "https://example.com/path with spaces",
    // URLs with non-ASCII characters
    nonAscii: "https://example.com/测试",
    // Malformed URLs
    malformed: "not a url",
    // Very long URLs
    long: "https://example.com/" + "a".repeat(1000)
};

// Utility function to construct error page URL
function constructErrorPageUrl(url, isNewTab) {
    // Encode the URL, handling any potential encoding errors
    let encodedUrl;
    try {
        encodedUrl = encodeURIComponent(url);
    } catch (e) {
        // If encoding fails, use a placeholder
        encodedUrl = encodeURIComponent("(invalid url)");
    }
    return `/error.html#url=${encodedUrl}&isNew=${isNewTab}`;
}

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

// Helper function to determine if a tab should be marked for removal
function shouldMarkTabForRemoval(tab, successfulTabIds) {
    return !successfulTabIds.has(tab.id);
}

// Helper function to determine if we need to keep a tab for safety
function needsSafetyTab(originalTabs, tabsMarkedForRemoval) {
    const originalNonPinnedIds = new Set(originalTabs.filter(t => !t.pinned).map(t => t.id));
    const markedNonPinnedIds = new Set(tabsMarkedForRemoval.filter(t => !t.pinned).map(t => t.id));
    return originalNonPinnedIds.size === markedNonPinnedIds.size &&
           tabsMarkedForRemoval.length > 0 &&
           tabsMarkedForRemoval.length === markedNonPinnedIds.size;
}

async function updateAndRemoveOldTabs(originalTabs, bookmarks, recurseTasks, updateTasks) {
    // Debug: Log initial state
    // console.log("[Debug] Initial tabs:", originalTabs.map(t => ({id: t.id, pinned: t.pinned, url: t.url})));
    // console.log("[Debug] Options:", storedOptions);

    let oldTabObjects = [...originalTabs];
    let isFirstUrlRef = { value: true };

    recurseBookmarks(oldTabObjects, bookmarks, recurseTasks, updateTasks, isFirstUrlRef);

    try {
        await Promise.all(recurseTasks);
        const arrayOfResults = await Promise.all(updateTasks);

        let okResults = arrayOfResults.filter(v => v.ok);
        let successfulTabIds = new Set(okResults.map(res => res.tab.id));

        if (storedOptions.includes("closeOtherTabs") && originalTabs.length > 0) {
            // Mark tabs for removal
            let tabsMarkedForRemoval = originalTabs.filter(tab =>
                shouldMarkTabForRemoval(tab, successfulTabIds)
            );

            // Debug: Log tabs marked for removal
            // console.log("[Debug] Tabs marked for removal:", tabsMarkedForRemoval.map(t => ({id: t.id, pinned: t.pinned, url: t.url})));

            let tabsToRemove = [...tabsMarkedForRemoval];
            let keepPinned = storedOptions.includes("keepPinnedTabs");

            // Apply pinned tab filter
            if (keepPinned) {
                tabsToRemove = tabsToRemove.filter(tab => !tab.pinned);
            } else if (needsSafetyTab(originalTabs, tabsMarkedForRemoval)) {
                // Safety check: keep at least one tab
                tabsToRemove.shift();
            }

            // Get final IDs and remove tabs
            let tabIdsToRemove = tabsToRemove.map(tab => tab.id);

            // Debug: Log final tabs to remove
            // console.log("[Debug] Final tabs to remove:", tabIdsToRemove);

            if (tabIdsToRemove.length > 0) {
                try {
                    await browser.tabs.remove(tabIdsToRemove);
                } catch (e) {
                    console.error("Error removing old tabs:", e);
                }
            }
        }

        // Handle errors
        let errs = arrayOfResults.filter(v => !v.ok);
        for (const err of errs) {
            let id = err.tab.id;
            let url = err.url;
            let errorPageUrl = constructErrorPageUrl(url, id == null);
            try {
                const tab = await tabUpdateOrCreate(id, { url: errorPageUrl }, false);
                // Debug: Log error page creation
                // console.log(`[Debug] Created error page for ${url} in tab ${tab.id}`);
            } catch (e) {
                console.error(`Failed to open error page for ${url}:`, e);
            }
        }
    } catch (e) {
        console.error("Error processing tab updates or bookmark recursion:", e);
    }
}

function loadTab(promise, id, url, updateTasks) {
    updateTasks.push(
        promise.then(
            tab => {
                // Debug: Log successful tab load
                // console.log(`[Debug] Successfully loaded tab ${tab.id} with URL ${url}`);
                return {ok:true, tab:tab, url:url};
            },
            e => {
                // Debug: Log failed tab load
                // console.log(`[Debug] Failed to load tab ${id} with URL ${url}: ${e.message}`);
                return {ok:false, tab:{id:id}, url:url, err:e.message};
            }
        )
    );
}

function recurseBookmarks(oldTabObjects, bookmarks, recurseTasks, updateTasks, isFirstUrlRef) {
    const keepPinned = storedOptions.includes("keepPinnedTabs");

    for (const child of bookmarks) {
        if (child.url != null) {
            let id = null;
            let oldTabIndex = -1;

            if (keepPinned) {
                for (let i = 0; i < oldTabObjects.length; i++) {
                    if (!oldTabObjects[i].pinned) {
                        oldTabIndex = i;
                        break;
                    }
                }
            } else {
                if (oldTabObjects.length > 0) {
                    oldTabIndex = 0;
                }
            }

            if (oldTabIndex !== -1) {
                id = oldTabObjects[oldTabIndex].id;
                oldTabObjects.splice(oldTabIndex, 1);
                // Debug: Log tab reuse
                // console.log(`[Debug] Reusing tab ${id} for URL ${child.url}`);
            } else {
                // Debug: Log new tab creation
                // console.log(`[Debug] Creating new tab for URL ${child.url}`);
            }

            let activate = false;
            if (storedOptions.includes("activateFirstTab") && isFirstUrlRef.value) {
                activate = true;
                isFirstUrlRef.value = false;
            }
            let p = tabUpdateOrCreate(id, { url: child.url }, activate);
            loadTab(p, id, child.url, updateTasks);
        } else {
            if (storedOptions.includes("recurse")) {
                let getting = browser.bookmarks.getChildren(child.id)
                    .then(newBookmarks => recurseBookmarks(oldTabObjects, newBookmarks, recurseTasks, updateTasks, isFirstUrlRef));
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
        // Use defaults if options not set (from options.js)
        storedOptions = options.options === undefined ? defaultOptions : options.options;

        // Use await for bookmarks and tabs query (can run in parallel)
        const [bms, tabs] = await Promise.all([
            browser.bookmarks.getChildren(id),
            browser.tabs.query({ currentWindow: true })
        ]);

        // Pass the full tabs array to updateAndRemoveOldTabs
        await updateAndRemoveOldTabs(tabs, bms, recurseTasks, updateTasks);

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
