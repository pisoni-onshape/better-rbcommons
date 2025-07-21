(function() {
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
      vscode: {settingId: 'vscodeExtensions', name: 'VS Code', icon: 'vscode-icon', getFullPath: (newtonPath, filePath) => `vscode://file${newtonPath}${filePath}`},
      idea: {settingId: 'ideaExtensions', name: 'IntelliJ IDEA', icon: 'idea-icon', getFullPath: (newtonPath, filePath) => `idea://open?file=${newtonPath}${filePath}`},
      webstorm: {settingId: 'webstormExtensions', name: 'WebStorm', icon: 'webstorm-icon', getFullPath: (newtonPath, filePath) => `webstorm://open?file=${newtonPath}${filePath}`},
      pycharm: {settingId: 'pycharmExtensions', name: 'PyCharm', icon: 'pycharm-icon', getFullPath: (newtonPath, filePath) => `pycharm://open?file=${newtonPath}${filePath}`},
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
    function createIconLink(iconResourceName, title, hrefURL, parentDiv, openInNewTab, callbackIfAny) {
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
        newIcon.style.width = '12px';
        newIcon.style.height = '12px';
        newIcon.style.verticalAlign = 'middle';
        newIcon.title = title;

        const newLink = document.createElement('a');
        if (openInNewTab) {
            newLink.target = '_blank';
        }
        newLink.name = iconResourceName;
        newLink.appendChild(newIcon);
        newLink.href = hrefURL;
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

    function getFileHandlerAndFullPath(filePath) {
        const newtonPath = getBaseNewtonDirectory();
        if (!newtonPath) {
            return null;
        }

        const defaultFileHandler = fileHandlers[gmSettings.getFieldValue('defaultHandlerApp')];
        let resultFullPath = '';
        let resultFileHandler = defaultFileHandler;

        const fileExtension = getFileExtension(filePath);
        if (fileExtension) {
          for (const ideKey in fileHandlers) {
            const currentHandler = fileHandlers[ideKey];
            let extensionsStr = gmSettings.getFieldValue(currentHandler.settingId);
            if (!extensionsStr) {
              continue;
            }

            // Some people (e.g. me) sometimes write '*.java' instead of '.java'
            extensionsStr = extensionsStr.replaceAll('*.','.');

            const handledExtensions = extensionsStr.split(/[,\s]+/);
            if (handledExtensions && handledExtensions.includes(fileExtension)) {
              resultFileHandler = currentHandler;
              break;
            }
          }
        }

        return { fileHandler: resultFileHandler, fullPath: resultFileHandler.getFullPath(newtonPath, filePath) };
    }

    function mainDiffPage() {
        // functions relevant only to the Diff Page
        let lastFileOnTop = null;

        function addFileNameAtTopStyle() {
            GM_addStyle(".filename-at-top-div { z-index: 999; position: fixed; opacity: 1; background-color: #EEDDDD; top: 0px; left: 0px; border: 1px solid; border-color: #AB7E7E; padding-left: 3px; padding-right: 3px; border-radius: 2px; box-shadow: 1px 1px lightgrey; }");
        }

        function getTableUnderMouse() {
            var hoveredItems = document.querySelectorAll(":hover");
            if (!hoveredItems || hoveredItems.length === 0) {
                return null;
            }

            var currentElement = hoveredItems[hoveredItems.length - 1];

            while (currentElement !== null) {
                if (currentElement.tagName.toLowerCase() === 'table') {
                    return currentElement;
                }

                currentElement = currentElement.parentElement;
            }

            return null;
        }

        // With latest changes from RBCommons it's not needed
        // in its entirety, but keep for some time.
        function activateFileNamesAtTheTop() {
            addFileNameAtTopStyle();

            function addIconLinks(filePath, parentElement) {
                filePath = filePath.trim();
                if (gmSettings.getFieldValue('enableFileGithubLink')) {
                  // Create the github button
                  const githubBasePath = gmSettings.getFieldValue('baseGithubPath');
                  if (!githubBasePath.endsWith('/')) {
                    githubBasePath += '/';
                  }
                  const fullGithubPath = githubBasePath + filePath;
                  createIconLink('github-icon', 'Open the file in Github', fullGithubPath, parentElement, true);
                }

                if (gmSettings.getFieldValue('enableQuickFileOpenLinks')) {
                  // Create the vscode button
                  const result = getFileHandlerAndFullPath(filePath);
                  if (!result) {
                    // newton path is not found. Ask the user to set it on demand.
                    const defaultFileHandler = fileHandlers.vscode;
                    createIconLink(defaultFileHandler.icon, 'Open the file in ' + defaultFileHandler.name, '#', parentElement, false, (event) => { gmSettings.openSettingsDialog(); });
                  } else {
                    createIconLink(result.fileHandler.icon, 'Open the file in ' + result.fileHandler.name, result.fullPath, parentElement, false);
                  }
                }
            }

            function createFixedAtTopDiv(id, filePath) {
                let newDiv = document.createElement('div');
                newDiv.id = id;
                newDiv.innerHTML = filePath;
                newDiv.classList.add("filename-at-top-div");

                addIconLinks(filePath, newDiv);

                document.body.appendChild(newDiv);
                return newDiv;
            }

            function fixOnTop(rowElement) {
                if (rowElement === null) {
                    console.log('Error: null row, returning');
                    return;
                }

                if (lastFileOnTop !== null) {
                    if (lastFileOnTop.id === rowElement.parentNode.parentNode.id + '_fixedOnTop') {
                        return;
                    } else {
                        removeTopFile();
                    }
                }

                lastFileOnTop = createFixedAtTopDiv(rowElement.parentNode.parentNode.id + '_fixedOnTop', rowElement.innerText);
            }

            function removeTopFile() {
                if (!lastFileOnTop) {
                    return;
                }
                lastFileOnTop.remove();
                lastFileOnTop = null;
            }

            function testFileNameRows() {
                const filenameRows = document.getElementsByClassName('filename-row');
                let foundOneOnTop = false;
                for (let filenameRow of filenameRows) {
                    if (!filenameRow.nextElementSibling) {
                        continue;
                    }

                    const filePath = filenameRow.innerText;
                    const elementToAddIcons = filenameRow.firstElementChild;

                    addIconLinks(filePath, elementToAddIcons);

                    const fileRevisionRowRect = filenameRow.nextElementSibling.getBoundingClientRect();
                    const fileRevisionRowIsAboveTheView = fileRevisionRowRect.top < 0;

                    // Find the bounds of the last row of this file's diff table.
                    const tableLastRowRect = filenameRow.parentNode.parentNode.lastElementChild.lastElementChild.getBoundingClientRect();
                    const tableLastRowIsAboveTheView = tableLastRowRect.top < 0;
                    if (fileRevisionRowIsAboveTheView && !tableLastRowIsAboveTheView) {
                        // If the filename is not visible but its table is, then put its name at the top
                        // var rowRect = filenameRow.nextElementSibling.getBoundingClientRect();
                        // var tableRect = filenameRow.parentNode.parentNode.lastElementChild.lastElementChild.getBoundingClientRect();
                        // console.log("File: " + filenameRow.innerText + " was fixed on top. Its top: " + rowRect.top + ", bottom: " + rowRect.bottom + ", table top: " + tableRect.top + ", table bottom: " + tableRect.bottom);
                        fixOnTop(filenameRow, true);
                        foundOneOnTop = true;
                        break;
                    }
                }

                if (!foundOneOnTop) {
                    removeTopFile();
                }
            }

            waitForElement('.reviewable-page').then((element) => {
                document.addEventListener('scroll', (event) => {
                    // handle the scroll event
                    testFileNameRows();
                });
            });
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

        let isShiftPressed = false;
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
                    isShiftPressed = true;
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
                    const multiple = 1.0 + (direction * 0.03);
                    let table = getTableUnderMouse();
                    if (!table) {
                        return;
                    }

                    const leftCol = table.querySelector('colgroup > .left');
                    const rightCol = table.querySelector('colgroup > .right');

                    if (leftCol) {
                        const currentWidthInPercent = leftCol.style.width ? parseInt(leftCol.style.width.replace("%",""),10) : Math.round(leftCol.offsetWidth / window.innerWidth * 100);
                        let newLeftWidth = currentWidthInPercent + (direction * 2);
                        if (newLeftWidth < 10)
                            newLeftWidth = 10;
                        if (newLeftWidth > 90)
                            newLeftWidth = 90;
                        leftCol.setAttribute("style","width:" + newLeftWidth + "%");
                        rightCol.setAttribute('style', 'width:' + (100- 2 - newLeftWidth) + '%');
                    }
                }
            });

            function removeLastSeparator() {
                if (lastSeparator) {
                    lastSeparator.remove();
                    lastSeparator = null;
                    lastTable = null;
                }
            }

            document.addEventListener('keyup', (event) => {
                isResizing = false;
                if (event.key === 'Shift') {
                    removeLastSeparator();
                    isShiftPressed = false;
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
                lastSeparatorLastLeft = lastSeparator ? parseInt(lastSeparator.style.left.replace('px','')) : -1;
                event.preventDefault();
                event.stopPropagation();
                return false;
            });

            document.addEventListener('mousemove', (event) => {
                //console.log('moving: isResizing:' + isResizing + ', event.shiftKey: ' + event.shiftKey);
                if (!isResizing || !event.shiftKey || !lastTable) {
                    return;
                }

                const leftCol = lastTable.querySelector('colgroup > .left');
                const rightCol = lastTable.querySelector('colgroup > .right');
                const leftColRect = leftCol.getBoundingClientRect();
                const currentLeftColWidth = leftCol.offsetWidth;
                const currentRightColWidth = rightCol.offsetWidth;
                const newLeftColWidth = event.clientX - leftColRect.left;
                const newPercentage = newLeftColWidth / (currentLeftColWidth + currentRightColWidth) * 100;
                leftCol.setAttribute('style', 'width:' + newPercentage + '%');
                rightCol.setAttribute('style', 'width:' + (100-2-newPercentage) + '%');
                setSeparatorPositions(lastTable, lastSeparator);
            });

            document.addEventListener('mouseup', (event) => {
                isResizing = false; // This should be done regardless of shiftKey is down or not.
                if (!event.shiftKey) {
                    return;
                }
            });
        }

        if (gmSettings.getFieldValue('enableResizingFileDiffs')) {
            activateDiffColumnResize();
        }
    }

    function mainAllPages() {
        function activateShowExtraLinks() {
            const arrNewLinks = [
                ['Incoming', '/s/bti/dashboard/?view=incoming'],
                ['Outgoing', '/s/bti/dashboard/?view=outgoing'],
                ['Better RBCommons Settings', '#', () => {gmSettings.openSettingsDialog();}]
            ];
            let ulElement = document.getElementById('navbar');
            if (ulElement) {
                for (const link of arrNewLinks) {
                    const newLink = document.createElement('li');
                    newLink.className = "rb-c-topbar__nav-item";
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

        if (gmSettings.getFieldValue('enableShowingExtraLinks')) {
            activateShowExtraLinks();
        }

        if (gmSettings.getFieldValue('enableShowingExactTimes')) {
            activateShowExactTimes();
        }
    }

    function loadSettings() {
        const rbCommonsConfig = {
            configId: 'betterRBCommons',
            headerText: "Better RBCommons Settings",
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
                    labelText: 'Default app for all extensions' ,
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
            saveButtonText: "Save",
            cancelButtonText: "Cancel"
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
