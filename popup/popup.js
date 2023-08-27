
const toggleCheckbox = document.getElementById('active');

if (toggleCheckbox) {
    toggleCheckbox.addEventListener('change', function() {
        const state = this.checked ? 'checked' : 'unchecked';
        updateToggle(this.checked);
        chrome.runtime.sendMessage({ type: 'toggleStateChange', state });
    });

    document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.sync.get('toggleState', function(data) {
            const isChecked = data.toggleState === 'checked';
            toggleCheckbox.checked = isChecked;
            updateToggle(isChecked);
        });
    });
}

function updateToggle(isChecked) {
    if (isChecked) {
        toggleCheckbox.parentElement.classList.add('toggle-active');
    } else {
        toggleCheckbox.parentElement.classList.remove('toggle-active');
    }
}

// Unified function to handle UI update
function handleUIUpdate(data) {
    hideAllSections();
    let section;
    let contentTitle, contentResult, btnCategory, progValue;

    switch (data.type) {
        case "default":
            section = document.getElementById('default-content');
            break;
        case "progress":
            section = document.getElementById('progress-content');
            progValue = section.querySelector('.prog-value');
            progValue.textContent = data.progressPercentage + "%";
            break;
        case "completed":
            section = document.getElementById('completed-content');
            break;
        case "malicious":
            section = document.getElementById('malicious-content');
            contentResult = section.querySelector('.mal-content-result');
            contentResult.textContent = data.result || "";
            
            contentTitle = section.querySelector('.mal-content-title');
            contentTitle.textContent = data.title || "";
            
            btnCategory = section.querySelector('.mal-btn-category');
            btnCategory.textContent = data.category || "";
            break;
        case "clean":
            section = document.querySelector('.clean-content');
            contentTitle = section.querySelector('.clean-content-title');
            contentTitle.textContent = data.title || "";
            break;
    }

    if (section) section.style.display = "block";
}

// to show certain section
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateUI") {
        handleUIUpdate(request.data);
    }
});

function hideAllSections() {
    const sections = document.querySelectorAll('.prog-content, .comp-content, .mal-content, .clean-content');
    for (const section of sections) {
        section.style.display = "none";
    }
}

chrome.runtime.sendMessage({ action: "getInitialState" }, function(response) {
    if (response.action === "updateUI") {
        handleUIUpdate(response.data);
    }
});
