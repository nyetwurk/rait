function render(info) {
    document.title = info.url;
    let aElement = document.createElement('a');
    aElement.setAttribute('href', info.url);
    aElement.appendChild(document.createTextNode(info.url));
    document.getElementById("bad_url").replaceWith(aElement);
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
