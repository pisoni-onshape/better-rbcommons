// ==UserScript==
// @name         Better RBCommons
// @namespace    piyushsoni
// @version      2.7.6
// @description  Add some useful little features to RBCommons.com website to work around its common annoyances.
// @author       Piyush Soni
// @match        https://www.rbcommons.com/*
// @match        https://rbcommons.com/s/*
// @icon         https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/icons/better-rbcommons-icon.png
// @require      https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/src/utils.js
// @require      https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/src/userscript-config.js
// @resource     Github-icon.png https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/resources/Github-icon.png
// @resource     VSCode-icon.png https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/resources/VSCode-icon.png
// @resource     IntelliJ_IDEA_Icon.svg https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/resources/IntelliJ_IDEA_Icon.svg
// @resource     PyCharm_Icon.svg https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/resources/PyCharm_Icon.svg
// @resource     WebStorm_Icon.svg https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/resources/WebStorm_Icon.svg
// @resource     config-style https://raw.githubusercontent.com/pisoni-onshape/better-rbcommons/236c73c706beea77bb1b2c8427400fd698fea52c/resources/userscript-config-style.css
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_getResourceURL
// @grant        GM_getResourceText
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(function () {
    'use strict';
    // Run the code only in the top level page, not in frames.
    if (window.top != window.self) {
        return;
    }

    // Confirm the User settings library is loaded.
    if (typeof UserScriptConfig === 'undefined') {
        console.error('Cannot load UserScriptConfig dependency. Quitting');
        return;
    } else if (typeof GM_getResourceText === 'function' && typeof GM_addStyle === 'function') {
        // I'm purposely not defining the GM_getResourceText function in the gm_polyfill.js,
        // as this style CSS would be automatically loaded into the page by Chrome's extension
        // loading mechanism, but it's needed when it's running in the form of a TamperMonkey
        // userscript.
        GM_addStyle(GM_getResourceText('config-style'));
    }

    // Test if the waitForElement method is available via dependent scripts
    if (typeof waitForElement === 'undefined') {
        console.error('required dependent function waitForElement not available. Quitting');
        return;
    }

    // Globals
    let gmSettings = null; // Will load them in loadSettings()
    const fileHandlers = {
        vscode: { settingId: 'vscodeExtensions', name: 'VS Code', icon: 'VSCode-icon.png', getFullPath: (newtonPath, filePath, lineNumber) => `vscode://file${newtonPath}/${filePath}` + (lineNumber ? ':' + lineNumber : '') },
        idea: { settingId: 'ideaExtensions', name: 'IntelliJ IDEA', icon: 'IntelliJ_IDEA_Icon.svg', getFullPath: (newtonPath, filePath, lineNumber) => `idea://open?file=${newtonPath}/${filePath}` + (lineNumber ? '&line=' + lineNumber : '') },
        webstorm: { settingId: 'webstormExtensions', name: 'WebStorm', icon: 'WebStorm_Icon.svg', getFullPath: (newtonPath, filePath, lineNumber) => `webstorm://open?file=${newtonPath}/${filePath}` + (lineNumber ? '&line=' + lineNumber : '') },
        pycharm: { settingId: 'pycharmExtensions', name: 'PyCharm', icon: 'PyCharm_Icon.svg', getFullPath: (newtonPath, filePath, lineNumber) => `pycharm://open?file=${newtonPath}/${filePath}` + (lineNumber ? '&line=' + lineNumber : '') },
    };

    function createIconLink(iconResourceName, title, href, parentDiv, openInNewTab, callbackIfAny) {
        if (!parentDiv) {
            return;
        }

        if (parentDiv.querySelector('a[name="' + iconResourceName + '"]')) {
            // Already exists.
            return;
        }

        parentDiv.appendChild(document.createTextNode('  '));

        let newIcon = document.createElement('img');
        let newIconURL = GM_getResourceURL(iconResourceName);
        newIcon.src = newIconURL;
        newIcon.className = 'file-open-icon';
        newIcon.title = title;

        const newLink = document.createElement('a');
        newLink.name = iconResourceName;
        newLink.appendChild(newIcon);
        newLink.href = href;

        const callback = callbackIfAny || ((event) => {
            event.preventDefault();
            event.stopPropagation();
            // Why callback? RBCommons blanket prevents regular link click
            // at a lot of places including the top Diff Files section :|
            // Having the href above is only so that the browser can show the
            // link it will go.
            if (openInNewTab) {
                window.open(href, '_blank');
            } else {
                window.location.href = href;
            }
        });
        newLink.addEventListener('click', callback);
        parentDiv.appendChild(newLink);
    }

    function getBaseNewtonDirectory() {
        let newtonBaseDirectory = gmSettings.getFieldValue('newtonPath');
        // There shouldn't be any, but trim any trailing '/' characters to be sure.
        return newtonBaseDirectory.replace(/\/+$/,'');
    }

    function getFileExtension(filePath) {
        const parts = filePath.split('.');
        // Avoiding files that are supposed to be
        // 'hidden' (e.g. .gitignore / .bashrc) for now.
        // I don't think they're needed for rbcommons for now.
        if (parts.length > 1 && parts[0] !== '') {
            return '.' + parts.pop();
        }

        return '';
    }

    function getDefaultFileHandler() {
        return fileHandlers[gmSettings.getFieldValue('defaultHandlerApp')];
    }

    function getFileHandlerAndFullPath(fileDetails /* {filePath, lineNumber} */) {
        const newtonPath = getBaseNewtonDirectory();
        if (!newtonPath || !fileDetails || !fileDetails.filePath) {
            return null;
        }

        const defaultFileHandler = getDefaultFileHandler();
        let resultFileHandler = defaultFileHandler;

        const fileExtension = getFileExtension(fileDetails.filePath);
        if (fileExtension) {
            for (const ideKey in fileHandlers) {
                const currentHandler = fileHandlers[ideKey];
                let extensionsStr = gmSettings.getFieldValue(currentHandler.settingId);
                if (!extensionsStr) {
                    continue;
                }

                // Some people (e.g. me) sometimes write '*.java' instead of '.java'
                extensionsStr = extensionsStr.replaceAll('*.', '.');

                const handledExtensions = extensionsStr.split(/[,\s]+/);
                if (handledExtensions && handledExtensions.includes(fileExtension)) {
                    resultFileHandler = currentHandler;
                    break;
                }
            }
        }

        return { fileHandler: resultFileHandler, fullPath: resultFileHandler.getFullPath(newtonPath, fileDetails.filePath, fileDetails.lineNumber) };
    }

    function mainDiffPage() {
        GM_addStyle(`
            .file-open-links { padding-left: 5px; text-align: right; display: inline-flex; gap: 10px; }
        `);

        GM_addStyle(`
            .file-open-icon { width: 14px; height: 14px; vertical-align: middle; cursor: pointer; }
        `);

        function addIconLinks(filePath, parentElement) {
            filePath = filePath.trim();
            if (gmSettings.getFieldValue('enableFileGithubLink')) {
                // Create the github button
                const fullGithubPath = getFullGithubURL({ filePath, lineNumber: null });
                createIconLink('Github-icon.png', 'Open the file in Github', fullGithubPath, parentElement, true);
            }

            if (gmSettings.getFieldValue('enableQuickFileOpenLinks')) {
                // Create the vscode button
                const result = getFileHandlerAndFullPath({ filePath, lineNumber: null });
                if (!result) {
                    // newton path is not found. Ask the user to set it on demand.
                    const defaultFileHandler = getDefaultFileHandler();
                    createIconLink(defaultFileHandler.icon, 'Open the file in ' + defaultFileHandler.name, '#', parentElement, false, (event) => { gmSettings.openSettingsDialog(); });
                } else {
                    createIconLink(result.fileHandler.icon, 'Open the file in ' + result.fileHandler.name, result.fullPath, parentElement, false);
                }
            }
        }

        function getFullGithubURL(fileDetails) {
            if (!fileDetails || !fileDetails.filePath) {
                return null;
            }
            const githubBasePath = gmSettings.getFieldValue('baseGithubPath');
            if (!githubBasePath.endsWith('/')) {
                githubBasePath += '/';
            }
            const fullGithubPath = githubBasePath + fileDetails.filePath + (fileDetails.lineNumber ? '#L' + fileDetails.lineNumber : '');
            return fullGithubPath;
        }

        function getFilenameAndLineUnderMouse() {
            const result = getTableUnderMouse(true /* get line number */);
            if (!result) {
                return null;
            }

            const lineNumber = result.line;
            const filePath = getFilepathFromTable(result.table);
            return { filePath, lineNumber };
        }

        function openFilePathInExternalEditor(fileDetails) {
            if (!fileDetails || !fileDetails.filePath) {
                return false;
            }

            const result = getFileHandlerAndFullPath(fileDetails);
            if (!result) {
                return false;
            }

            // Open the file.
            window.location.href = result.fullPath;
            return true;
        }

        function openFilePathOnGithub(fileDetails) {
            if (!fileDetails || !fileDetails.filePath) {
                return false;
            }

            const fullGithubPath = getFullGithubURL(fileDetails);
            if (fullGithubPath) {
                window.open(fullGithubPath, '_blank');
                return true;
            }

            return false;
        }

        function activateGeneralShortcuts() {
            document.addEventListener('keydown', (event) => {
                let handled = false;
                switch (event.key) {
                    case 'o':
                        if (!event.ctrlKey || !gmSettings.getFieldValue('enableQuickFileOpenLinks')) {
                            return;
                        }

                        handled = openFilePathInExternalEditor(getFilenameAndLineUnderMouse());
                    break;
                    case 'g':
                        if (!event.ctrlKey || !gmSettings.getFieldValue('enableFileGithubLink')) {
                            return;
                        }

                        handled = openFilePathOnGithub(getFilenameAndLineUnderMouse());
                    break;
                }

                if (handled) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
        }

        function addFileHandlersOnFilenameRows() {
            // Add file open links on the top of every individual file's diff section, and the files in the 'Files' section at the top, that also
            // now remains at the top
            const elementsToAddLinks = [...document.querySelectorAll('.filename-row > th'), ...document.querySelectorAll('.diff-file-info')];
            for (let containerElement of elementsToAddLinks) {
                if (containerElement.querySelector('.file-open-links')) {
                    // already exists
                    continue;
                }

                const filePath = containerElement.innerText.trim();
                const newSpan = document.createElement('span');
                newSpan.className = 'file-open-links';
                containerElement.appendChild(newSpan);
                addIconLinks(filePath, newSpan);
            }
        }

        function getTableUnderMouse(doGetLineNumber /* boolean */) {
            const hoveredItems = document.querySelectorAll(':hover');
            if (!hoveredItems || hoveredItems.length === 0) {
                return null;
            }

            let currentElement = hoveredItems[hoveredItems.length - 1];
            let lineAttribute = '';
            while (currentElement !== null) {
                if (doGetLineNumber && currentElement.tagName.toLocaleLowerCase() === 'tr') {
                    lineAttribute = currentElement.getAttribute('line');
                } else if (currentElement.tagName.toLowerCase() === 'table') {
                    return doGetLineNumber ? { table: currentElement, line: lineAttribute } : currentElement;
                }

                currentElement = currentElement.parentElement;
            }

            return null;
        }

        function getFilepathFromTable(table) {
            if (!table) {
                return null;
            }

            const filenameRow = table.querySelector('thead > tr.filename-row');
            return filenameRow ? filenameRow.textContent.trim() : '';
        }

        function setSeparatorPositions(table, separator) {
            // Select all tbody elements from the table that are not collapsed 'headers'
            const nonHeaderTBodies = table.querySelectorAll('tbody:not(.diff-header)');
            if (!nonHeaderTBodies || nonHeaderTBodies.length === 0) {
                return;
            }

            const firstNonHeaderTBody = nonHeaderTBodies[0];
            const lastNonHeaderTBody = nonHeaderTBodies[nonHeaderTBodies.length - 1];

            // 1. Find out the separator's top position:
            const offsetFromTop = firstNonHeaderTBody.offsetTop;

            // 2. Find the Separator's left position:
            const firstCenterTH = firstNonHeaderTBody.querySelector('tr > th:nth-child(3)');
            if (!firstCenterTH) {
                return;
            }

            const columnCenter = firstCenterTH.offsetLeft + firstCenterTH.offsetWidth / 2;

            // 3. Separator's height:
            // The total height is last non-header tbody's bottom minus first non-header tbody's top
            const lastNonDiffTbodyBottom = lastNonHeaderTBody.offsetTop + lastNonHeaderTBody.offsetHeight;
            let totalSeparatorHeight = lastNonDiffTbodyBottom - firstNonHeaderTBody.offsetTop;


            separator.style.top = offsetFromTop + 'px';
            separator.style.left = columnCenter + 'px';
            separator.style.height = totalSeparatorHeight + 'px';
        }

        function activateDiffColumnResize() {
            let lastSeparator = null;
            let lastTable = null;

            // Override diff table's minimum width of 615px, it's too big.
            GM_addStyle(`
                .revision-row > th.revision-col { min-width: 300px !important; }
            `);

            // Resize diff box columns
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Shift') {
                    let table = getTableUnderMouse();
                    if (!table) {
                        return;
                    }

                    removeLastSeparator();

                    let separator = document.createElement('div');
                    separator.id = 'separator';
                    separator.style.position = 'absolute';
                    separator.style.borderColor = 'black';
                    separator.style.zIndex = '99999 !important';
                    separator.style.backgroundColor = 'grey';
                    separator.style.border = '1px solid';
                    separator.style.cursor = 'col-resize';
                    separator.style.width = '3px';
                    setSeparatorPositions(table, separator);
                    lastSeparator = separator;
                    lastTable = table;
                    table.parentElement.appendChild(separator);
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    // Left/Right arrow
                    const direction = event.key === 'ArrowRight' ? 1 : -1;
                    let table = getTableUnderMouse();
                    if (!table) {
                        return;
                    }

                    resizeDiffPanesToNewCenter(table, null, direction);
                }
            });

            function removeLastSeparator() {
                if (lastSeparator) {
                    lastSeparator.remove();
                    lastSeparator = null;
                    lastTable = null;
                }
            }

            function resizeDiffPanesToNewCenter(table, newCenter, directionIfAny) {
                const leftCol = table.querySelector('colgroup > .left');
                const leftColRect = leftCol.getBoundingClientRect();
                const centerCol = leftCol.nextElementSibling;
                const centerColRect = centerCol.getBoundingClientRect();
                const rightCol = table.querySelector('colgroup > .right');
                const rightColRect = rightCol.getBoundingClientRect();
                // If newCenter is not give, but a 'direction' is given (arrow keys)
                // just do some percent change.
                if (!newCenter && typeof directionIfAny === 'number') {
                    const oldCenter = (centerColRect.left + centerColRect.right) / 2;
                    const PERCENT_CHANGE = 0.03;
                    const multiple = 1.0 + (directionIfAny * PERCENT_CHANGE);
                    newCenter = oldCenter * multiple;
                }

                // New right of the left column will be the mouseX coordinate minus
                // half of the central column width.
                const newRight = newCenter - centerColRect.width / 2.0;
                const oldLeftWidth = leftColRect.width;
                const newLeftWidth = newRight - leftColRect.left;
                const diff = newLeftWidth - oldLeftWidth;
                const oldRightWidth = rightColRect.width;
                const newRightWidth = oldRightWidth - diff;
                leftCol.setAttribute('style', 'width:' + newLeftWidth + 'px');
                rightCol.setAttribute('style', 'width:' + newRightWidth + 'px');
            }

            document.addEventListener('keyup', (event) => {
                isResizing = false;
                if (event.key === 'Shift') {
                    removeLastSeparator();
                }
            });

            let isResizing = false;
            let lastSeparatorLastLeft = -1;
            document.addEventListener('mousedown', (event) => {
                //console.log('mousedown: event.shiftKey: ' + event.shiftKey + ', event.target.tagName : ' + event.target.tagName + ', event.target.id: ' + event.target.id);
                if (!event.shiftKey || event.target.id !== 'separator') {
                    if (!event.shiftKey) {
                        removeLastSeparator();
                    }
                    return;
                }

                isResizing = true;
                lastSeparatorLastLeft = lastSeparator ? parseInt(lastSeparator.style.left.replace('px', '')) : -1;
                event.preventDefault();
                event.stopPropagation();
                return false;
            });

            document.addEventListener('mousemove', (event) => {
                //console.log('moving: isResizing:' + isResizing + ', event.shiftKey: ' + event.shiftKey);
                if (!isResizing || !event.shiftKey || !lastTable) {
                    return;
                }

                resizeDiffPanesToNewCenter(lastTable, event.clientX);
                setSeparatorPositions(lastTable, lastSeparator);
            });

            document.addEventListener('mouseup', (event) => {
                isResizing = false; // This should be done regardless of shiftKey is down or not.
                if (!event.shiftKey) {
                    return;
                }
            });
        }

        waitForElement('.reviewable-page').then((element) => {
            if (gmSettings.getFieldValue('enableResizingFileDiffs')) {
                activateDiffColumnResize();
            }

            if (gmSettings.getFieldValue('enableKeyboardShortcuts')) {
                activateGeneralShortcuts();
            }

            document.addEventListener('scroll', (event) => {
                // handle the scroll event
                addFileHandlersOnFilenameRows();
            });
        });
    }

    function mainAllPages() {
        function activateJiraPreviews() {
            const URL_REGEX = /^https?:\/\/rbcommons\.com\/s\/bti\/r\/\d+\/bugs\/([A-Z]+-\d+)\/?$/;
            const JIRA_API_BASE_URL = 'https://belmonttechinc.atlassian.net/rest/api/2/issue/';
            const PREVIEW_WIDTH = '450px'; // Slightly wider for better layout
            const MAX_PREVIEW_HEIGHT = '500px'; // Max height before scrollbar appears
            // x, y offsets from the jira link's bounding box.
            const PREVIEW_OFFSET_X = 5;
            const PREVIEW_OFFSET_Y = 5;
            const DEBOUNCE_DELAY = 150;

            let previewDiv = null;
            let hoverTimer = null;
            let hideTimer = null;

            function getNestedProperty(obj, path) {
                return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : null, obj);
            }

            function renderIssueDetails(issueData, originalUrl) {
                const fields = issueData.fields || {}; // Ensure fields object exists

                const issueKey = getNestedProperty(issueData, 'key') || 'N/A';
                const summary = getNestedProperty(fields, 'summary') || 'No Summary';
                const fixVersion = getNestedProperty(fields, 'fixVersions.0.name') || 'None';
                const assigneeName = getNestedProperty(fields, 'assignee.displayName') || 'Unassigned';
                const assigneeEmail = getNestedProperty(fields, 'assignee.emailAddress') || '';
                const statusName = getNestedProperty(fields, 'status.name') || 'Unknown';
                const priorityName = getNestedProperty(fields, 'priority.name') || 'Unknown';
                const description = getNestedProperty(fields, 'description') || 'No description provided.';

                const formattedDescription = description.replace(/\n/g, '<br>');

                return `
                    <div style="font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.2; color: #333;">
                        <h3 style="margin-top: 0; margin-bottom: 5px; font-size: 1.2em; border-bottom: 1px solid #eee; padding-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                            <a href="${originalUrl}" target="_blank" style="text-decoration: none; color: #007bff; font-weight: bold;">${issueKey}</a>
                            <span style="font-size: 0.8em; color: #666;">Status: ${statusName}</span>
                        </h3>

                        <p style="font-weight: bold; margin-bottom: 5px;">Summary:</p>
                        <p style="margin-top: 0; margin-bottom: 5px; background-color: #f9f9f9; padding: 4px; border-radius: 4px;">${summary}</p>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px;">
                            <div>
                                <p style="font-weight: bold; margin-bottom: 5px;">Assignee:</p>
                                <p style="margin-top: 0;">${assigneeName} ${assigneeEmail ? `<br><a href="mailto:${assigneeEmail}" style="color: #007bff; text-decoration: none;">${assigneeEmail}</a>` : ''}</p>
                            </div>
                            <div>
                                <p style="font-weight: bold; margin-bottom: 5px;">Priority:</p>
                                <p style="margin-top: 0;">${priorityName}</p>
                            </div>
                            <div>
                                <p style="font-weight: bold; margin-bottom: 5px;">Fix Version:</p>
                                <p style="margin-top: 0;">${fixVersion}</p>
                            </div>
                        </div>

                        <p style="font-weight: bold; margin-bottom: 5px;">Description:</p>
                        <div style="max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 8px; border-radius: 4px; background-color: #fcfcfc;">
                            ${formattedDescription}
                        </div>
                    </div>
                `;
            }

            function createPreviewDiv(contentHtml, linkRect) {
                // If a preview div already exists, remove it first to ensure only one is active.
                if (previewDiv) {
                    removePreviewDiv();
                }

                previewDiv = document.createElement('div');
                previewDiv.style.cssText = `
                    position: fixed; /* Position relative to the viewport */
                    border: 1px solid #ccc; /* Simple border */
                    box-shadow: 0 4px 12px rgba(0,0,0,0.25); /* Soft shadow for depth */
                    border-radius: 8px; /* Rounded corners */
                    overflow: hidden; /* Hide scrollbars for the main div */
                    z-index: 99999; /* Ensure it's on top of most page content */
                    width: ${PREVIEW_WIDTH};
                    max-height: ${MAX_PREVIEW_HEIGHT}; /* Set max height for scroll */
                    background-color: white; /* Background color for the preview div */
                    opacity: 0; /* Start with opacity 0 for a fade-in effect */
                    transition: opacity 0.2s ease-in-out; /* Smooth transition for opacity changes */
                    padding: 10px; /* Padding inside the preview div */
                    font-family: sans-serif; /* Readable font */
                    color: #333; /* Dark gray text color */
                    pointer-events: auto; /* IMPORTANT: Allow mouse events on the div itself */
                    display: flex;
                    flex-direction: column;
                `;
                document.body.appendChild(previewDiv);

                previewDiv.addEventListener('mouseover', () => {
                    clearTimeout(hideTimer);
                });

                previewDiv.addEventListener('mouseout', () => {
                    hideTimer = setTimeout(removePreviewDiv, DEBOUNCE_DELAY);
                });

                // Prepare the previewDiv in advance, to show on hover.
                previewDiv.innerHTML = contentHtml;
                positionPreviewDiv(linkRect);

                // Use a small timeout to trigger the CSS transition for fade-in.
                setTimeout(() => {
                    if (previewDiv) {
                        previewDiv.style.opacity = '1'; // Fade in
                    }
                }, 10);
            }

            function removePreviewDiv() {
                if (previewDiv) {
                    previewDiv.style.opacity = '0'; // Start fade-out

                    const divToRemove = previewDiv;
                    previewDiv = null; // Clear the global reference immediately

                    // Wait for the fade-out transition to complete before removing the element
                    setTimeout(() => {
                        if (divToRemove.parentNode) {
                            divToRemove.parentNode.removeChild(divToRemove);
                        }
                    }, 200); // Matches the CSS transition duration
                    console.log('[Link Preview] Hiding preview div.');
                }
            }

            function positionPreviewDiv(linkRect) {
                if (!previewDiv) return;

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const divRect = previewDiv.getBoundingClientRect(); // Get current size of preview div

                // Calculate initial position relative to the link's bottom-left
                let left = linkRect.left + PREVIEW_OFFSET_X;
                let top = linkRect.bottom + PREVIEW_OFFSET_Y;

                // Adjust 'left' if the div goes off the right edge of the viewport
                if (left + divRect.width > viewportWidth - 10) { // 10px padding from edge
                    // Try positioning to the left of the link
                    left = linkRect.left - divRect.width - PREVIEW_OFFSET_X;
                    if (left < 10) { // If still off the left edge, center it horizontally
                        left = (viewportWidth - divRect.width) / 2;
                    }
                }

                // Adjust 'top' if the div goes off the bottom edge of the viewport
                if (top + divRect.height > viewportHeight - 10) { // 10px padding from edge
                    // Try positioning above the link
                    top = linkRect.top - divRect.height - PREVIEW_OFFSET_Y;
                    if (top < 10) { // If still off the top edge, center it vertically
                        top = (viewportWidth - divRect.height) / 2;
                    }
                }

                // Apply the calculated position, ensuring it's never negative
                previewDiv.style.left = `${Math.max(0, left)}px`;
                previewDiv.style.top = `${Math.max(0, top)}px`;
            }

            function handleLinkMouseOver(event) {
                const linkElement = event.currentTarget; // The link element itself
                const contentHtml = linkElement.dataset.jiraPreviewHtml;

                // If content is not yet loaded, or if it failed to load, show a temporary message
                if (!contentHtml) {
                    // This case should ideally not happen if initializeJiraLinkPreview was called and completed
                    // but provides a fallback.
                    console.warn('[Link Preview] Content not yet loaded or failed for this link:', linkElement.href);
                    // Optionally, you could display a "Loading..." message here if you want immediate feedback.
                    return;
                }

                clearTimeout(hideTimer); // Clear any pending hide timer

                if (hoverTimer) {
                    clearTimeout(hoverTimer);
                }

                hoverTimer = setTimeout(() => {
                    const linkRect = linkElement.getBoundingClientRect();
                    createPreviewDiv(contentHtml, linkRect);
                }, DEBOUNCE_DELAY);
            }

            function handleLinkMouseOut(event) {
                clearTimeout(hoverTimer);

                // If the mouse is moving FROM the link TO the previewDiv, do NOT hide.
                if (previewDiv && previewDiv.contains(event.relatedTarget)) {
                    clearTimeout(hideTimer); // Ensure no hide timer is active
                    return;
                }

                hideTimer = setTimeout(() => {
                    removePreviewDiv();
                }, DEBOUNCE_DELAY);
            }

            function initializeJiraLinkPreview(linkElement) {
                if (!linkElement || !linkElement.href) {
                    console.error('[Link Preview] Invalid linkElement provided to initializeJiraLinkPreview.');
                    return;
                }

                const url = linkElement.href;
                const matches = url.match(URL_REGEX);

                if (!matches || matches.length < 2) {
                    console.warn(`[Link Preview] Link does not match Jira regex, skipping initialization: ${url}`);
                    return;
                }

                const issueId = matches[1];
                const apiUrl = JIRA_API_BASE_URL + issueId;

                // Prevent re-initialization if already processed
                if (linkElement.dataset.jiraPreviewInitialized) {
                    console.log(`[Link Preview] Link ${issueId} already initialized.`);
                    return;
                }
                linkElement.dataset.jiraPreviewInitialized = 'true'; // Mark as initialized
                console.log(`[Link Preview] Initializing for link: ${url}, fetching from: ${apiUrl}`);

                GM.xmlHttpRequest({
                    method: "GET",
                    url: apiUrl,
                    headers: {
                        "User-Agent": navigator.userAgent,
                        "Referer": window.location.href,
                        "Accept": "application/json",
                        "Accept-Language": "en-US,en;q=0.5",
                    },
                    onload: function(response) {
                        let renderedHtml = '';
                        // linkElement.style.cursor = ''; // Remove loading indicator

                        if (response.status === 200) {
                            try {
                                const issueData = JSON.parse(response.responseText);
                                renderedHtml = renderIssueDetails(issueData, url); // Pass original URL for link in preview
                                console.log(`[Link Preview] Successfully fetched and rendered for ${issueId}.`);
                            } catch (e) {
                                renderedHtml = `Cannot fetch Jira issue details. Make sure you're signed in.`;
                                console.error('[Link Preview] Error parsing JSON for ' + issueId + ':', e);
                            }
                        } else {
                            renderedHtml = `Cannot fetch Jira issue details. Make sure you're signed in.`;
                            console.error(`[Link Preview] Failed to fetch for ${issueId}. Status: ${response.status}`);
                        }
                        // Store the rendered HTML on the link element
                        linkElement.dataset.jiraPreviewHtml = renderedHtml;

                        // Attach event listeners to this specific link element
                        linkElement.addEventListener('mouseover', handleLinkMouseOver);
                        linkElement.addEventListener('mouseout', handleLinkMouseOut);
                    },
                    onerror: function(error) {
                        const renderedHtml = `Cannot fetch Jira issue details. Make sure you're signed in.`;
                        linkElement.dataset.jiraPreviewHtml = renderedHtml;
                        console.error('[Link Preview] Network error fetching content for ' + issueId + ':', error);

                        // Attach event listeners even on error, so the error message can be shown
                        linkElement.addEventListener('mouseover', handleLinkMouseOver);
                        linkElement.addEventListener('mouseout', handleLinkMouseOut);
                    }
                });
            };

            // No global initialization needed here, as the user will call initializeJiraLinkPreview
            // for specific links.
            waitForElement('#field_bugs_closed').then((element) => {
                let bugsClosed = element.querySelectorAll('a.bug');
                for (const bug of bugsClosed) {
                    initializeJiraLinkPreview(bug);
                }
            });
        }

        function activateShowExtraLinks() {
            const arrNewLinks = [
                ['idIncoming', 'Incoming', '/s/bti/dashboard/?view=incoming'],
                ['idOutgoing', 'Outgoing', '/s/bti/dashboard/?view=outgoing']
            ];
            let ulElement = document.getElementById('navbar');
            if (ulElement) {
                for (const link of arrNewLinks) {
                    if (document.querySelector(link[0])) {
                        continue;
                    }
                    const newLink = document.createElement('li');
                    newLink.className = 'rb-c-topbar__nav-item';
                    newLink.innerHTML = '<a href="' + link[2] + '">' + link[1] + '</a>';
                    ulElement.appendChild(newLink);
                }
            }
        }

        function activateShowExactTimes() {
            function insertAfter(newChild, nodeToInsertAfter) {
                const nextSibling = nodeToInsertAfter.nextSibling;
                if (nextSibling) {
                    nodeToInsertAfter.parentNode.insertBefore(newChild, nextSibling);
                } else {
                    nodeToInsertAfter.parentNode.appendChild(newChild);
                }
            }

            let timeElements = document.getElementsByClassName('timesince');
            for (let i = 0; i < timeElements.length; ++i) {
                const thisElement = timeElements[i];
                const title = thisElement.getAttribute('title');
                if (title && title.length > 0) {
                    // Add a new element showing the exact time
                    const text = thisElement.textContent;
                    const newSibling = document.createElement('span');
                    newSibling.id = 'timestamp';
                    newSibling.style.color = 'grey';
                    newSibling.style.fontSize = '10 px';
                    newSibling.innerText = ' (' + title + ')';
                    insertAfter(newSibling, thisElement);
                }
            }
        }

        function createRBCommonsSettingsMenuItem() {
            // Create Settings link in RBCommons 'gear' icon menu
            const menu = document.querySelector('.ink-c-menu-label > .ink-c-menu');
            if (!menu) {
                return;
            }

            const liElement = document.createElement('li');
            liElement.className = 'ink-c-menu__item';
            liElement.draggable = false;
            liElement.tabIndex = -1;
            liElement.id = 'betterRBCommonsSettings';
            liElement.addEventListener('click', (event) => gmSettings.openSettingsDialog());

            const innerSpan = document.createElement('span');
            innerSpan.className = 'ink-c-menu__item-inner';

            const iconSpan = document.createElement('span');
            iconSpan.classList.add('ink-c-menu__item-icon');
            iconSpan.classList.add('ink-i-check');
            iconSpan.style.maskImage = 'url(data:image/svg+xml;utf8,%3Csvg%20id%3D%22Layer_1%22%20data-name%3D%22Layer%201%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2048%2048%22%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill%3Anone%3Bstroke%3A%23000%3Bstroke-linecap%3Around%3Bstroke-linejoin%3Around%3Bstroke-width%3A2px%3B%7D%3C%2Fstyle%3E%3C%2Fdefs%3E%3Ctitle%3Egear%3C%2Ftitle%3E%3Cpath%20class%3D%22cls-1%22%20d%3D%22M44%2C28V20H38.44A14.89%2C14.89%2C0%2C0%2C0%2C37%2C16.61L41%2C12.69%2C35.31%2C7%2C31.39%2C11A14.89%2C14.89%2C0%2C0%2C0%2C28%2C9.56V4H20V9.56A14.89%2C14.89%2C0%2C0%2C0%2C16.61%2C11L12.69%2C7%2C7%2C12.69%2C11%2C16.61A14.89%2C14.89%2C0%2C0%2C0%2C9.56%2C20H4v8H9.56A14.89%2C14.89%2C0%2C0%2C0%2C11%2C31.39L7%2C35.31%2C12.69%2C41%2C16.61%2C37A14.89%2C14.89%2C0%2C0%2C0%2C20%2C38.44V44h8V38.44A14.89%2C14.89%2C0%2C0%2C0%2C31.39%2C37L35.31%2C41%2C41%2C35.31%2C37%2C31.39A14.89%2C14.89%2C0%2C0%2C0%2C38.44%2C28Z%22%2F%3E%3Ccircle%20class%3D%22cls-1%22%20cx%3D%2224%22%20cy%3D%2224%22%20r%3D%2210%22%2F%3E%3Crect%20class%3D%22cls-1%22%20x%3D%22-418%22%20y%3D%22-146%22%20width%3D%22680%22%20height%3D%22680%22%2F%3E%3C%2Fsvg%3E)';

            const textLabel = document.createElement('label');
            textLabel.className = 'ink-c-menu__item-label';
            textLabel.textContent = 'Better RBCommons Settings';

            innerSpan.appendChild(iconSpan);
            innerSpan.appendChild(textLabel);

            liElement.appendChild(innerSpan);

            menu.appendChild(liElement);
        }

        waitForElement('.ink-c-menu-label > .ink-c-menu').then((element) => {
            if (gmSettings.getFieldValue('enableShowingExtraLinks')) {
                activateShowExtraLinks();
            }

            if (gmSettings.getFieldValue('enableShowingExactTimes')) {
                activateShowExactTimes();
            }

            createRBCommonsSettingsMenuItem();
        });

        function registerCommentEditorShortcuts() {
            // The page tries to capture all Comment editor, so we have to steal
            // it from one level below theirs (but still limit the scope to our
            // requirement).
            onNewElement(document.body, '.rb-c-text-editor', (editorElement) => {
                const targetNode = editorElement.querySelector('.CodeMirror');
                if (!targetNode) {
                    return;
                }

                targetNode.addEventListener('keydown', (event) => {
                    if (!event.metaKey && !event.ctrlKey) {
                        return;
                    }

                    switch (event.key) {
                        case 'b':
                        case 'i':
                        case 'c':
                        case 'x':
                        case 'u':
                            const buttons = {
                                'b': {title: 'Bold', additionalCondition: true},
                                'i': {title: 'Italic', additionalCondition: true},
                                'c': {title: 'Code literal', additionalCondition: event.shiftKey},
                                'x': {title: 'Strikethrough', additionalCondition: event.shiftKey},
                                'u': {title: 'Insert link', additionalCondition: event.shiftKey}
                            }

                            const buttonSelector = buttons[event.key];
                            if (buttonSelector.additionalCondition === true && (isMacOS() ? event.metaKey : event.ctrlKey)) {
                                const targetNode = event.currentTarget; // Should be the one I added the event to.
                                const actionButton = targetNode && targetNode.parentElement && targetNode.parentElement.querySelector(`button[title="${buttonSelector.title}"]`);
                                if (actionButton) {
                                    fireClickEvent(actionButton);
                                    event.preventDefault();
                                    event.stopPropagation();
                                }
                            }
                        break;
                    }
                });
            });
        }

        function registerFullPageShortcuts() {
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey && event.key === 'r' ) {
                    gmSettings.openSettingsDialog();
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
        }

        if (gmSettings.getFieldValue('enableKeyboardShortcuts')) {
            registerCommentEditorShortcuts();
            registerFullPageShortcuts();
        }

        if (gmSettings.getFieldValue('showJiraPreviews')) {
            activateJiraPreviews();
        }
    }

    function loadSettings() {
        const rbCommonsConfig = {
            configId: 'betterRBCommons',
            headerText: 'Better RBCommons Settings',
            groups: [
                { id: 'linkHandlers', name: 'Link Handlers', collapsedIf: { otherElementId: 'enableQuickFileOpenLinks', value: false } }
            ],
            settings: [
                {
                    id: 'showJiraPreviews',
                    type: 'checkbox',
                    labelText: 'Show a hover preview of Jira Bugs',
                    defaultValue: true
                },
                {
                    id: 'enableShowingExtraLinks',
                    type: 'checkbox',
                    labelText: 'Show extra navbar links',
                    defaultValue: true
                },
                {
                    id: 'enableShowingExactTimes',
                    type: 'checkbox',
                    labelText: 'Show exact times',
                    tooltip: 'Show absolute time besides RBCommons relative times like 2 days, 19 hours ago',
                    defaultValue: true
                },
                {
                    id: 'enableResizingFileDiffs',
                    type: 'checkbox',
                    labelText: 'Allow resizing file diff panes',
                    tooltip: 'Resize file diff panes by pressing arrow keys or Shift + Mouse drag',
                    defaultValue: true
                },
                {
                    id: 'enableKeyboardShortcuts',
                    type: 'checkbox',
                    labelText: 'Enable keyboard shortcuts',
                    tooltip: 'Enable keyboard shortcuts for opening Settings, Github URLs, file handlers etc.',
                    defaultValue: true
                },
                {
                    id: 'enableFileGithubLink',
                    type: 'checkbox',
                    labelText: 'Show Github link for file',
                    defaultValue: true
                },
                {
                    id: 'baseGithubPath',
                    type: 'textbox',
                    labelText: 'Github file base path',
                    placeholder: 'https://github.com/<path>/',
                    defaultValue: 'https://github.com/onshape/newton/blob/master/',
                    validationRegex: '^https:\/\/github\.com\/.+\/$',
                    enabledIf: { otherElementId: 'enableFileGithubLink', value: true },
                },
                {
                    id: 'enableQuickFileOpenLinks',
                    type: 'checkbox',
                    labelText: 'Show quick file open links',
                    defaultValue: true
                },
                {
                    id: 'newtonPath',
                    type: 'textbox',
                    labelText: 'Newton repository Path',
                    placeholder: '/Users/<username>/repos/newton',
                    defaultValue: '',
                    validationRegex: '^\/.+\/.+',
                    errorMessage: 'Please enter valid path to your newton directory',
                    enabledIf: { otherElementId: 'enableQuickFileOpenLinks', value: true },
                },
                {
                    id: 'defaultHandlerApp',
                    type: 'dropdown',
                    labelText: 'Default app for all extensions',
                    defaultValue: 'vscode',
                    tooltip: 'Default handler for all unspecified extensions',
                    options: [
                        { value: 'vscode', text: 'VS Code' },
                        { value: 'idea', text: 'IntelliJ IDEA' },
                        { value: 'webstorm', text: 'Webstorm' },
                        { value: 'pycharm', text: 'PyCharm' }
                    ],
                    enabledIf: { otherElementId: 'enableQuickFileOpenLinks', value: true },
                    groupId: 'linkHandlers'
                },
                {
                    id: 'vscodeExtensions',
                    type: 'textbox',
                    labelText: 'Extensions opened by VSCode',
                    placeholder: '.ts, .js, .html, .vue, ...',
                    defaultValue: '.ts, .js, .glsl, .java, .cpp, .h',
                    enabledIf: { otherElementId: 'enableQuickFileOpenLinks', value: true },
                    groupId: 'linkHandlers'
                },
                {
                    id: 'ideaExtensions',
                    type: 'textbox',
                    labelText: 'Extensions opened by IntelliJ IDEA',
                    placeholder: '.java, ...',
                    defaultValue: '',
                    enabledIf: { otherElementId: 'enableQuickFileOpenLinks', value: true },
                    groupId: 'linkHandlers'
                },
                {
                    id: 'webstormExtensions',
                    type: 'textbox',
                    labelText: 'Extensions opened by Webstorm',
                    placeholder: '.ts, .js, ...',
                    defaultValue: '',
                    enabledIf: { otherElementId: 'enableQuickFileOpenLinks', value: true },
                    groupId: 'linkHandlers'
                },
                {
                    id: 'pycharmExtensions',
                    type: 'textbox',
                    labelText: 'Extensions opened by Pycharm',
                    placeholder: '.py, ...',
                    defaultValue: '',
                    enabledIf: { otherElementId: 'enableQuickFileOpenLinks', value: true },
                    groupId: 'linkHandlers'
                }
            ],
            saveButtonText: 'Save',
            cancelButtonText: 'Cancel'
        };
        const callbacks = {
            onSettingsSaved: () => { window.location.reload(); }
        }
        gmSettings = new UserScriptConfig(rbCommonsConfig, callbacks);
        gmSettings.init();
    }

    function main() {
        loadSettings();

        // Main code begins here.
        let url = new String(window.top.location.href).toLowerCase();

        // Functions that will execute on all pages
        mainAllPages();

        // Functions that will execute only on the 'diff' pages.
        if (url.indexOf('/diff/') > 0) {
            // All functions applicable to the Diff Viewer page of RBCommons
            mainDiffPage();
        }
    }

    main();

})();
