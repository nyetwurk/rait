browser.contextMenus.create({
    id: "replace-all-in-tabs",
    title: "Replace All In Tabs",
    contexts: ["bookmark"]
});

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

// Helper function to update an existing tab or create a new one
// Returns a promise that resolves with the tab object
function tabUpdateOrCreate(id, prop, activate) {
    let finalProp = { ...prop }; // Copy properties

    // Only set 'active' property if explicitly told to activate
    // Otherwise, let the browser decide the default active state.
    // The decision to activate is made *before* calling this function.
    if (activate) {
        finalProp.active = true;
    }

    if (id != null) {
        return browser.tabs.update(id, finalProp);
    }
    // Ensure 'active' is only set if needed, even for new tabs
    if (!activate) {
        delete finalProp.active; // Don't force inactive if not needed
    }
    return browser.tabs.create(finalProp);
}

// Helper function to determine if a tab should be marked for removal
function shouldMarkTabForRemoval(tab, successfulTabIds) {
    return !successfulTabIds.has(tab.id);
}

// Utility function to get a Set of non-pinned tab IDs from a list of tab objects
function getNonPinnedIds(tabs) {
    return new Set(tabs.filter(t => !t.pinned).map(t => t.id));
}

// Helper function to determine if we need to keep a tab for safety
// This is only called when 'keepPinnedTabs' is FALSE.
// It checks if *all* original non-pinned tabs were *also* marked for removal
// (meaning none of them were successfully reused for new bookmarks).
function needsSafetyTab(originalTabs, tabsMarkedForRemoval) {
    const originalNonPinnedIds = getNonPinnedIds(originalTabs);
    const markedNonPinnedIds = getNonPinnedIds(tabsMarkedForRemoval);

    // If the set of non-pinned original tabs is the same size as the set of non-pinned marked tabs,
    // and there are actually tabs marked (i.e., size > 0), it means no original non-pinned tab was reused.
    // We compare sizes as a simple way to check if the sets contain the same elements in this specific context.
    return originalNonPinnedIds.size > 0 && originalNonPinnedIds.size === markedNonPinnedIds.size;
}

// Helper function to find the index of a reusable tab based on keepPinned setting
function findReusableTabIndex(tabObjects, keepPinned) {
    if (keepPinned) {
        // Find the index of the first *unpinned* tab
        return tabObjects.findIndex(tab => !tab.pinned);
    } else {
        // Find the index of the first available tab, regardless of pinned status
        // If the list has items, the index is 0, otherwise it's -1 implicitly (length check handles this)
        return tabObjects.length > 0 ? 0 : -1;
    }
}

async function updateAndRemoveOldTabs(originalTabs, bookmarks, recurseTasks, updateTasks, currentOptions) {
    // Debug: Log initial state
    // console.log("[Debug] Initial tabs:", originalTabs.map(t => ({id: t.id, pinned: t.pinned, url: t.url})));
    // console.log("[Debug] Options:", currentOptions);

    let oldTabObjects = [...originalTabs];
    let isFirstUrlRef = { value: true };

    // Pass options down to recurseBookmarks
    recurseBookmarks(oldTabObjects, bookmarks, recurseTasks, updateTasks, isFirstUrlRef, currentOptions);

    try {
        await Promise.all(recurseTasks);
        const arrayOfResults = await Promise.all(updateTasks);

        let okResults = arrayOfResults.filter(v => v.ok);
        let successfulTabIds = new Set(okResults.map(res => res.tab.id));

        // Check options locally
        if (currentOptions.includes("closeOtherTabs") && originalTabs.length > 0) {
            let tabsMarkedForRemoval = originalTabs.filter(tab =>
                shouldMarkTabForRemoval(tab, successfulTabIds)
            );

            let tabsToRemove = [...tabsMarkedForRemoval];
            // Determine keepPinned locally
            const keepPinned = currentOptions.includes("keepPinnedTabs");

            if (keepPinned) {
                tabsToRemove = tabsToRemove.filter(tab => !tab.pinned);
            } else if (needsSafetyTab(originalTabs, tabsMarkedForRemoval)) {
                tabsToRemove.shift();
            }

            let tabIdsToRemove = tabsToRemove.map(tab => tab.id);

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

function recurseBookmarks(oldTabObjects, bookmarks, recurseTasks, updateTasks, isFirstUrlRef, currentOptions) {
    const keepPinned = currentOptions.includes("keepPinnedTabs");

    for (const child of bookmarks) {
        if (child.url != null) {
            let id = null;

            // Use the helper function to find the index
            const oldTabIndex = findReusableTabIndex(oldTabObjects, keepPinned);

            // If we found a tab to reuse
            if (oldTabIndex !== -1) {
                id = oldTabObjects[oldTabIndex].id;
                // Remove the reused tab from the list
                oldTabObjects.splice(oldTabIndex, 1);
                // Debug: Log tab reuse
                // console.log(`[Debug] Reusing tab ${id} for URL ${child.url}`);
            } else {
                // Debug: Log new tab creation
                // console.log(`[Debug] Creating new tab for URL ${child.url}`);
            }

            // Determine activation status
            let activate = false;
            if (currentOptions.includes("activateFirstTab") && isFirstUrlRef.value) {
                activate = true;
                isFirstUrlRef.value = false;
            }

            // Create/update tab and add task
            let p = tabUpdateOrCreate(id, { url: child.url }, activate);
            loadTab(p, id, child.url, updateTasks);
        } else {
            // Handle folders
            if (currentOptions.includes("recurse")) {
                let getting = browser.bookmarks.getChildren(child.id)
                    .then(newBookmarks => recurseBookmarks(oldTabObjects, newBookmarks, recurseTasks, updateTasks, isFirstUrlRef, currentOptions));
                recurseTasks.push(getting);
            }
        }
    }
}

async function replaceAllInTabs(id) {
    let recurseTasks = [];
    let updateTasks = [];

    try {
        const settings = await browser.storage.local.get();
        // Determine effective options locally
        const effectiveOptions = settings.options === undefined ? defaultOptions : settings.options;

        const [bms, tabs] = await Promise.all([
            browser.bookmarks.getChildren(id),
            browser.tabs.query({ currentWindow: true })
        ]);

        // Pass effectiveOptions down
        await updateAndRemoveOldTabs(tabs, bms, recurseTasks, updateTasks, effectiveOptions);

    } catch (e) {
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
