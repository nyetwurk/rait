function render(info) {
    document.title = info.url;
    let aElement = document.createElement('a');
    aElement.setAttribute('href', info.url);
    aElement.appendChild(document.createTextNode(info.url));
    document.getElementById("bad_url").replaceWith(aElement);
    if (info.isNew === 'false') {
	let button = document.createElement('div');
	button.innerHTML = '<button>Restore tab contents</button>';
	button.addEventListener('click', () => { window.history.back(); });
	document.body.appendChild(button);
    }
}

window.onload = function() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const url = hashParams.get('url');
    const isNew = hashParams.get('isNew');

    if (url) {
        render({ url: url, isNew: isNew });
    } else {
        console.error("Error page loaded without URL in hash.");
        document.getElementById("bad_url").textContent = "Error: Could not determine the problematic URL.";
    }
};
