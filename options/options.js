/*
Store the currently selected settings using browser.storage.local.
*/
function storeSettings() {
  function getOptions() {
    let options = [];
    const menuItems = document.querySelectorAll(".menu-item");
    for (let item of menuItems) {
      // Check if the item has the 'checked' class
      if (item.classList.contains("checked")) {
        // Get option name from data attribute
        options.push(item.dataset.option);
      }
    }
    return options;
  }

  const options = getOptions();
  browser.storage.local.set({
    options
  });
}

/*
Update the options UI with the settings values retrieved from storage,
or the default settings if the stored settings are empty.
*/
function updateUI(restoredSettings) {
  const menuItems = document.querySelectorAll(".menu-item");
  for (let item of menuItems) {
    const optionName = item.dataset.option;
    // Check if the option was stored as selected
    if (restoredSettings.options && restoredSettings.options.includes(optionName)) {
      item.classList.add("checked");
      item.setAttribute("aria-checked", "true");
    } else {
      item.classList.remove("checked");
      item.setAttribute("aria-checked", "false");
    }
  }
}

function onError(e) {
  console.error(e);
}

/*
Handle click on a menu item
*/
function handleItemClick(event) {
  const item = event.currentTarget;
  const isChecked = item.classList.toggle("checked");
  item.setAttribute("aria-checked", isChecked ? "true" : "false");
  storeSettings(); // Save immediately after toggling
}

/*
Initialization:
1. Fetch stored settings and update the UI.
2. Add click listeners to menu items.
*/

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch settings and update UI
        const settings = await browser.storage.local.get();
        let effectiveOptions;

        // Check if options have NEVER been saved before for this user
        if (settings.options === undefined) {
            // Set the initial default state, including keepPinnedTabs
            effectiveOptions = ["keepPinnedTabs"];
            // Save these defaults back to storage for the first time
            await browser.storage.local.set({ options: effectiveOptions });
        } else {
            // Options HAVE been saved before (even if it's an empty array now)
            // Respect the user's saved choices entirely.
            effectiveOptions = settings.options; // Use exactly what was saved
        }

        // Update the UI based on the determined settings
        updateUI({ options: effectiveOptions });

        // Add click listeners now that DOM is ready and UI is updated
        const menuItems = document.querySelectorAll(".menu-item");
        for (let item of menuItems) {
            // Check if it's a toggleable option item
            if (item.dataset.option) {
                item.addEventListener('click', handleItemClick);
            } else if (item.id === 'about-link') {
                // Handle click for the 'View on GitHub' item (ID is 'about-link')
                item.addEventListener('click', () => {
                    const repoUrl = "https://github.com/nyetwurk/rait";
                    browser.tabs.create({ url: repoUrl });
                    window.close(); // Close the popup after opening the tab
                });
            } else if (item.id === 'view-in-addons') {
                // Handle click for the 'Feedback' item
                item.addEventListener('click', () => {
                    const amoUrl = "https://addons.mozilla.org/en-US/firefox/addon/replace-all-in-tabs/";
                    browser.tabs.create({ url: amoUrl });
                    window.close(); // Close the popup after opening the tab
                });
            }
        }

    } catch (e) {
        onError(e); // Use the existing error handler
    }
});
