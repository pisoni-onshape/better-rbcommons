# Better RBCommons
A simple userscript that adds some useful little features to RBCommons.com website to work around some of its common annoyances. Once installed, it works automatically on RBCommons pages and does not interfere with any of the current functionalities. 

## Uses:
1. Firstly, the script allows you to dynamically resize the diff pane on review reqeusts (something that should have been built-in). Just press the Shift button down on any diff page and start moving the separator to resize the pane width using the mouse, or just press the left or right arrow keys to resize them (play the gif).
    ![Resizing Panes](https://github.com/pisoni-onshape/better-rbcommons/assets/87058498/70b746de-25ff-4e1a-89c8-c1bc8a66cb57)

2. While reviewing files, I always have to scroll up to check or confirm the filename I'm currently looking at. The script adds a very small filename div at the top-left corner of the screen whenever its name is not visible to you
    <img width="855" alt="Filenames at top" src="https://github.com/pisoni-onshape/better-rbcommons/assets/87058498/3d8ed78a-2990-4f76-babb-151869b63eb3">

3. Relative times are fine some times, but I want to see the exact dates much more often. So wherever RBCommons pages show relative times, it automatically adds a date time stamp near that in your local time.
    <img width="481" alt="rbcommons-timestamp" src="https://github.com/pisoni-onshape/better-rbcommons/assets/87058498/c2b4ed8c-c0b7-4e63-842b-d39de4c27f68">


4. Most of the times I'm interested in only two lists: the open reviews assigned to me, and the open reviews I have created. The script thus adds two additional links in the top navigation header to allow you to quickly go there (normally you have to go to the dashboard first and choose from there).

    <img width="730" alt="rbcommons-new-links" src="https://github.com/pisoni-onshape/better-rbcommons/assets/87058498/a045e38e-a670-4f65-8145-80f461ac6e20">


## How to install:
1. Install the TamperMonkey extension for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) or [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) (The Chrome one should work in other Chromium based browsers). 
2. Pin the extension to the browser taskbar if not already visible (not required, but it helps to see if the script is active: 

    <img width="200" alt="image" src="https://github.com/pisoni-onshape/better-rbcommons/assets/87058498/128d807d-7855-4cc1-b043-e0b112d614d4">

3. Click on https://github.com/pisoni-onshape/better-rbcommons/raw/main/Better%20RBCommons.user.js to install the current version of the Better RBCommons script. You can now use RBCommons as before and it should add some features in a non-intrusive way. 


## Adjustments:
1. You don't have to use or enable all features if you install the script. Disable the ones you don't like like this from the Tampermonkey Menu when on any RBcommons page: 

    <img width="279" alt="rbcommons-toggle-features" src="https://github.com/pisoni-onshape/better-rbcommons/assets/87058498/674f0e36-232b-42fa-90dd-2c320a1728ea">

2. It is a very simple and self-explanatory regular JS script. If you want to add or edit some functionality, just click Edit against the script in TamperMonkey menu, save, and refresh the page.

    <img width="200" alt="better-rbcommons-edit" src="https://github.com/pisoni-onshape/better-rbcommons/assets/87058498/f9defe6c-9e83-4d3e-9208-3a7ea73a6a98">
