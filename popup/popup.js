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

        const leftSidebar = document.querySelector('.left-side-bar');
        if (leftSidebar) {
            leftSidebar.style.display = 'none';
        } 
    });
}

function updateToggle(isChecked) {
    if (isChecked) {
        toggleCheckbox.parentElement.classList.add('toggle-active');
    } else {
        toggleCheckbox.parentElement.classList.remove('toggle-active');
    }
}

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
            if (data.result === "ransomware"){
                const leftSidebar = document.querySelector('.left-side-bar');
            }
            
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


function updateUI() {
    chrome.storage.local.get('extensionState', function(result) {
        if (result.extensionState) {
            handleUIUpdate(result.extensionState);
        }
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "stateChanged") {
        updateUI();
    }
    else if (request.action === "updateUI") {
        handleUIUpdate(request.data);
    }
});

// .content, .prog-content, .comp-content, .mal-content, .clean-content
function hideAllSections() {
    const sections = document.getELementsByClass('.content, .comp-content, .mal-content, .clean-content');
    for (const section of sections) {
        section.style.display = "none";
    }
}
