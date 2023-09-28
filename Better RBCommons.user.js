// ==UserScript==
// @name         Better RBCommons
// @namespace    piyushsoni
// @version      1.0
// @description  Add some useful little features to RBCommons.com website to work around its common annoyances.
// @author       Piyush Soni
// @match        https://rbcommons.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rbcommons.com
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

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

    function mainDiffPage() {
        // functions relevant only to the Diff Page

        let lastFileOnTop = null;

        function getTableUnderMouse() {
            var hoveredItems = document.querySelectorAll(":hover");
            if (!hoveredItems || hoveredItems.length === 0) {
                return null;
            }

            var currentElement  = hoveredItems[hoveredItems.length - 1];

            while (currentElement !== null) {
                if (currentElement.tagName.toLowerCase() === 'table') {
                    return currentElement;
                }

                currentElement = currentElement.parentElement;
            }

            return null;
        }

        function activateFileNamesAtTheTop() {
            function createFixedAtTopDiv(id, innerText) {
                let newDiv = document.createElement('div');
                newDiv.id = id;
                newDiv.innerHTML = innerText;
                newDiv.style.zIndex = "999";
                newDiv.style.position = "fixed";
                newDiv.style.opacity = "1";
                newDiv.style.backgroundColor = "#EEDDDD";
                newDiv.style.top = "0";
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
                        if (newLeftWidth < 30)
                            newLeftWidth = 30;
                        if (newLeftWidth > 70)
                            newLeftWidth = 70;
                        //const newRightWidth = 100 - 2 - newLeftWidth;
                        //console.log('current width is : ' + currentWidthInPercent + ', setting new width to : ' + newLeftWidth + "%");
                        leftCol.setAttribute("style","width:" + newLeftWidth + "%");
                        rightCol.setAttribute('style', 'width:' + (100-newLeftWidth) + '%');
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
                rightCol.setAttribute('style', 'width:' + (100-newPercentage) + '%');
                setSeparatorPositions(lastTable, lastSeparator);
            });

            document.addEventListener('mouseup', (event) => {
                isResizing = false; // This should be done regardless of shiftKey is down or not.
                if (!event.shiftKey) {
                    return;
                }
            });
        }

        let fileNamesAtTheTopEnabled = GM_getValue('fileNamesAtTheTopEnabled', true);
        if (fileNamesAtTheTopEnabled) {
            activateFileNamesAtTheTop();
        }

        GM_registerMenuCommand((fileNamesAtTheTopEnabled ? 'Disable ' : 'Enable ') + 'Filenames at the top', () => {
            GM_setValue('fileNamesAtTheTopEnabled', !GM_getValue('fileNamesAtTheTopEnabled', true));
            window.location.reload();
        });

        let resizeDiffColumnsEnabled = GM_getValue('resizeDiffColumnsEnabled', true);
        if (resizeDiffColumnsEnabled) {
            activateDiffColumnResize();
        }

        GM_registerMenuCommand((resizeDiffColumnsEnabled ? 'Disable ' : 'Enable ') + 'Resizing Diff Columns', () => {
            GM_setValue('resizeDiffColumnsEnabled', !GM_getValue('resizeDiffColumnsEnabled', true));
            window.location.reload();
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
                    newLink.innerHTML = '<a href="' + link[1] + '">' + link[0] + '</a>';
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
                if (title.length > 0) {
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

        let showExtraLinksEnabled = GM_getValue('showExtraLinksEnabled', true);
        if (showExtraLinksEnabled) {
            activateShowExtraLinks();
        }

        GM_registerMenuCommand((showExtraLinksEnabled ? 'Disable ' : 'Enable ') + 'show extra links', () => {
            GM_setValue('showExtraLinksEnabled', !GM_getValue('showExtraLinksEnabled', true));
            window.location.reload();
        });

        let showExactTimesEnabled = GM_getValue('showExactTimesEnabled', true);
        if (showExactTimesEnabled) {
            activateShowExactTimes();
        }

        GM_registerMenuCommand((showExactTimesEnabled ? 'Disable ' : 'Enable ') + 'show exact times', () => {
            GM_setValue('showExactTimesEnabled', !GM_getValue('showExactTimesEnabled', true));
            window.location.reload();
        });
    }

    // Main code begins here.
    let url = new String(window.top.location.href).toLowerCase();
    if (url.indexOf('/diff/') > 0) {
      // All functions applicable to the Diff Viewer page of RBCommons
      mainDiffPage();
    }

    mainAllPages();

})();