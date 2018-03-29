function render(info) {
    document.title = info.url;
    let errorDiv = document.createElement('div');
    errorDiv.innerHTML =
	`Web extensions are not permitted to load <a href="${info.url}">${info.url}</a>.<br>` +
	`Report this bug to <a href="https://bugzilla.mozilla.org/">Mozilla</a>.`;
    document.body.appendChild(errorDiv);
    if (!info.isNew) {
	let button = document.createElement('div');
	button.innerHTML = '<button>Restore tab contents</button>';
	button.addEventListener('click', () => { history.back() });
	document.body.appendChild(button);
    }
}

window.onload = function() {
    browser.runtime.sendMessage({ action: "getError" }, render);
}
