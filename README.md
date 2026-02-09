# Replace All in Tabs (RAiT) - Firefox Extension

This Firefox WebExtension provides a context menu item for bookmark folders to open the bookmarks in new tabs, replacing all currently open tabs (similar to the legacy Tab Replace addon and the removed native browser functionality).

## Features

* Adds a "Replace All in Tabs" option to the right-click context menu for bookmark folders.
* Provides options (accessible via the extension popup) to:
  * Keep pinned tabs open.
  * Recursively open bookmarks in sub-folders.
  * Make the first opened tab active.
  * Close all other non-pinned tabs *after* loading the new ones.

## Installation

* **Get it from Firefox Add-ons:** [Replace All in Tabs](https://addons.mozilla.org/en-US/firefox/addon/replace-all-in-tabs/)

## Source Code & Development

* **GitHub Repository:** [nyetwurk/rait](https://github.com/nyetwurk/rait)

## Background & Motivation

This extension aims to restore functionality that was previously available either natively or through older addons:

* The default Firefox behavior for "Open all in Tabs" adds new tabs instead of replacing existing ones.
* An older native option (`browser.tabs.loadFolderAndReplace`) was removed ([Bugzilla 395024](https://bugzilla.mozilla.org/show_bug.cgi?id=395024)).
* The original "Tab Replace" addon stopped working with Firefox Quantum.
* WebExtensions limitations prevent overriding the default left-click behavior or modifying the main bookmark menu directly ([Bugzilla 1448518](https://bugzilla.mozilla.org/show_bug.cgi?id=1448518)). This extension uses the context menu as the available alternative.
* Chrome/Chromium currently cannot support this extension because the required `"bookmark"` context for context menus is not implemented. See [Chromium Issue 412168561](https://issues.chromium.org/issues/412168561).

## License

This project is licensed under the terms of the [GPL v3](LICENSE).
