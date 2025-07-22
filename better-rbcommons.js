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
    } else {
        GM_addStyle(GM_getResourceText('config-style'));
    }

    // Globals
    let gmSettings = null; // Will load them in loadSettings()
    const fileHandlers = {
        vscode: { settingId: 'vscodeExtensions', name: 'VS Code', icon: 'vscode-icon', getFullPath: (newtonPath, filePath, lineNumber) => `vscode://file${newtonPath}${filePath}` + (lineNumber ? ':' + lineNumber : '') },
        idea: { settingId: 'ideaExtensions', name: 'IntelliJ IDEA', icon: 'idea-icon', getFullPath: (newtonPath, filePath, lineNumber) => `idea://open?file=${newtonPath}${filePath}` + (lineNumber ? '&line=' + lineNumber : '') },
        webstorm: { settingId: 'webstormExtensions', name: 'WebStorm', icon: 'webstorm-icon', getFullPath: (newtonPath, filePath, lineNumber) => `webstorm://open?file=${newtonPath}${filePath}` + (lineNumber ? '&line=' + lineNumber : '') },
        pycharm: { settingId: 'pycharmExtensions', name: 'PyCharm', icon: 'pycharm-icon', getFullPath: (newtonPath, filePath, lineNumber) => `pycharm://open?file=${newtonPath}${filePath}` + (lineNumber ? '&line=' + lineNumber : '') },
    };

    // Helper functions
    function waitForElement(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    //'github-icon', 'Open the file in Github', fullGithubPath, newDiv
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
        if (openInNewTab) {
            newLink.target = '_blank';
        }
        newLink.name = iconResourceName;
        newLink.appendChild(newIcon);
        newLink.href = href;
        // Prevent RBCommons preventing clicks to go through
        const callback = callbackIfAny || ((event) => { event.stopPropagation(); });
        newLink.addEventListener('click', callback);
        parentDiv.appendChild(newLink);
    }

    function getBaseNewtonDirectory() {
        let newtonBaseDirectory = gmSettings.getFieldValue('newtonPath');
        if (!newtonBaseDirectory.endsWith('/')) {
            newtonBaseDirectory += '/';
        }
        return newtonBaseDirectory;
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
            .file-open-links { padding-left: 5px; text-align: right; }
        `);

        GM_addStyle(`
            .file-open-icon { width: 14px; height: 14px; vertical-align: middle; }
        `);

        function addIconLinks(filePath, parentElement) {
            filePath = filePath.trim();
            if (gmSettings.getFieldValue('enableFileGithubLink')) {
                // Create the github button
                const fullGithubPath = getFullGithubURL({ filePath, lineNumber: null });
                createIconLink('github-icon', 'Open the file in Github', fullGithubPath, parentElement, true);
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

        function activateGeneralShortcuts() {
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
                    window.open(fullGithubPath);
                    return true;
                }

                return false;
            }

            document.addEventListener('keypress', (event) => {
                if (!event.ctrlKey) {
                    return false;
                }

                let filePath;
                switch (event.key) {
                    case 'r':
                        gmSettings.openSettingsDialog();
                        break;
                    case 'o':
                        if (!gmSettings.getFieldValue('enableQuickFileOpenLinks')) {
                            return false;
                        }

                        return openFilePathInExternalEditor(getFilenameAndLineUnderMouse());
                        break;
                    case 'g':
                        if (!gmSettings.getFieldValue('enableFileGithubLink')) {
                            return false;
                        }

                        return openFilePathOnGithub(getFilenameAndLineUnderMouse());
                        break;
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

            var filenameRow = table.querySelector('thead > tr.filename-row');
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

            // Activate this regardless:
            activateGeneralShortcuts();
            document.addEventListener('scroll', (event) => {
                // handle the scroll event
                addFileHandlersOnFilenameRows();
            });
        });
    }

    function mainAllPages() {
        function activateShowExtraLinks() {
            const arrNewLinks = [
                ['Incoming', '/s/bti/dashboard/?view=incoming'],
                ['Outgoing', '/s/bti/dashboard/?view=outgoing']
            ];
            let ulElement = document.getElementById('navbar');
            if (ulElement) {
                for (const link of arrNewLinks) {
                    const newLink = document.createElement('li');
                    newLink.className = 'rb-c-topbar__nav-item';
                    newLink.innerHTML = '<a href="' + link[1] + '">' + link[0] + '</a>';
                    if (link[2]) {
                        newLink.addEventListener('click', link[2]);
                    }
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
