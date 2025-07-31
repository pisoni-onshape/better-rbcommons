/** gm_polyfill.js
 * Author: Piyush Soni
 * A compatibility layer for common TamperMonkey GM_ API functions
 * to Chrome/Firefox WebExtension APIs
 * Mostly so that I can maintain a single source of
 * better-rbcommons.user.js and use it either as part of
 * the extension, or a plain and simple userscript.
 * */

// Make sure it works for both Chrome and Firefox.
const browserAPI = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

if (!browserAPI) {
  console.error("GM_Polyfill: Neither 'chrome' nor 'browser' API found. Polyfill will not function.");
}

// PS ToDo : Write async forms of GM_setValue and GM_getValue and use them
// in the script userscript-config properly.

window.GM_addStyle = function(css) {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
};

window.GM_getResourceURL = function(resourceName) {
  if (!browserAPI || !browserAPI.runtime || !browserAPI.runtime.getURL) {
    console.error("GM_getResourceURL: runtime.getURL API not available.");
    return null;
  }
  return browserAPI.runtime.getURL("resources/" + resourceName);
};
