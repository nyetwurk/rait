/*
Store the currently selected settings using browser.storage.local.
*/
function storeSettings() {
  function getOptions() {
    let options = [];
    const checkboxes = document.querySelectorAll(".options [type=checkbox]");
    for (let item of checkboxes) {
      if (item.checked) {
        options.push(item.getAttribute("option"));
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
  const checkboxes = document.querySelectorAll(".options [type=checkbox]");
  for (let item of checkboxes) {
    if (restoredSettings.options.indexOf(item.getAttribute("option")) != -1) {
      item.checked = true;
    } else {
      item.checked = false;
    }
  }
}

function onError(e) {
  console.error(e);
}

/*
On opening the options page, fetch stored settings and update the UI with them.
*/
const gettingStoredSettings = browser.storage.local.get();
gettingStoredSettings.then(updateUI, onError);

const checkboxes = document.querySelectorAll(".options [type=checkbox]");
for (let item of checkboxes) {
    item.onclick = storeSettings;
}
