# Better RBCommons
A simple Extension that adds some useful little features to RBCommons.com website to work around some of its common annoyances while reviewing code, more especially the newton codebase. Once installed, it works automatically on RBCommons pages and does not interfere with any of the current functionalities. Most of the added features are also configurable.

## Uses
1. The script allows you to seamlessly and dynamically resize the diff pane on review requests (something that should have been built-in). Just press the Shift button down on any diff page and start moving the separator to resize the pane width using the mouse, or just press the left or right arrow keys over a file diff section to resize them.

1. Quickly shows you a hover preview of the bugs being resolved to check important details.

1. It adds quick links (icons) and on most newton file paths to open them in the external IDE of choice from a pre-set list of available file handlers, for example VS Code. You can set file extensions to be opened in different IDEs through the Script's settings. Similarly, it adds a 'Open with Github' link for every file in the Diff viewer page to quickly open that in the newton repository (the path is entirely configurable, so it can really be anything). It is especially helpful in reviewing larger changes that you have applied to your local machine to test, now you can check the newly added class members / functions and their usage much more easily  in your IDE.

1. For an even quicker access, it allows keyboard shortcuts like Ctrl+O and Ctrl+G to open the currently being hovered file immediately in the configured editor and in Github repository respectively, around the line your mouse was at!

1. While writing any comment on the review request, now you can quickly press Cmd (/Ctrl) + B to make the selected text bold, Cmd+E to make it italic (they use 'I' for something else and I did't want to change the default), and Cmd+Shift+C to make it a code literal, just like you do on Slack.

1. 'Relative times' (e.g. 'Review created 19 days and 2 hours ago') are fine, but I want to see the exact dates much more often. So wherever RBCommons pages show relative times, it automatically adds a date time stamp near that in your local time so that you don't have to calculate.

1. Most of the times I'm interested in only two lists: the open reviews assigned to me, and the open reviews I have created. The script thus adds two additional links in the top navigation header to allow you to quickly go there (normally you have to go to the dashboard first and choose from there).

## Configuring options
1. Press Ctrl+R any time to open 'Better RBCommons' settings. You can also click the 'Gear' icon near the top navigation bar, and you'll find the 'Better RBCommons Settings' menu item. The settings are remembered in your local storage, and are used the next time you open the reviews.
1. The first time you install the script and try to open the file in your configured editor by pressing the VS Code icon link, it will automatically open up this settings dialog, as you have not configured the path of your base newton directory yet.
1. It is custom made for the 'newton' repository by default, but it really doesn't matter what paths you give in the settings for the base project directory on your local machine, and for Github.
1. You can add various extensions (e.g. `.cpp, .h`) to any external application from the set of supported applications, or leave them empty. The 'Default' selected application will open all the files with unspecified extensions.

## How to install
You can install the script in two ways:
1. As a valid self-contained unpacked Chrome Extension (Firefox coming later):
    - Download the entire `better-rbcommons-extension` folder from this repository (please note the folder name)
    - Go to the `chrome://extensions` page
    - Enable Developer mode
    - Click 'Load unpacked', and select the folder you just downloaded
    - (It should also be available in [releases](https://github.com/onshape/onshape-dev-tools/releases) for direct install, but we'll have to work with IT to officially allow it for internal distribution)
1. As a 'userscript' (easy to edit and iterate):
    - Install the TamperMonkey browser extension for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) or [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en).
    - Find the better-rbcommons.user.js file in the src folder, and open its 'Raw' version in Github
    - TamperMonkey should automatically offer you to install it.
1. Once you install, refresh any RBCommons review page for the extension to take effect.