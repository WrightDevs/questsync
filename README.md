# Multi-session sync browser

Runs several isolated browser windows side by side. Each window has its own
cookies and login, and your actions in one can be copied to the others.

## Run it
1. Install Node.js (https://nodejs.org)
2. In this folder:
   npm install
   npm start

## Use it
- Choose your country via the top buttons: **🇳🇬 NG (/ng/m)** or **🇬🇭 GH (/gh/m)** to instantly switch SportyBet mobile country domains and URLs across all panes.
- Type an address and press "Load in all" (or click a country button to load its homepage directly).
- Log in separately in each window. Sessions are saved, so you only do this once.
- "Mirror clicks and scrolling": click or scroll in any window and the others follow using both DOM events and native hardware mouse events.
  The window you touch is the lead.
- "Mirror typing" is off by default so usernames are not copied between accounts.
  Password fields are never mirrored.
- "Fill in all": enter a CSS selector for a field and a value, and it is written
  into that field in every window.
- "Set stakes for profit" (also switches on "Keep updated", so after the first click the stakes follow the odds by themselves): type a target profit, the selector for the odds on the bet slip,
  and the selector for the stake box. For each window the app reads that window's odds and
  sets stake = target profit / (odds - 1), rounded down so profit never goes above the target.
  Example: target 500, odds 2.50 -> stake 333 -> profit 499.5.
  Tick "Keep updated" to recalculate when the odds change. Each window uses its own odds.
- "Zoom": use the - and + buttons (or Ctrl and minus / Ctrl and plus inside a pane) to shrink or enlarge all panes.
  Ctrl+0 resets. Zooming out shows more of each page at once.
- On sites like SportyBet with on-screen number pads or read-only stake inputs:
  "Set stakes for profit" verifies the stake directly, automatically handles the on-screen keypad (Clear + Digits) via native input clicks, and verifies the displayed stake in every pane.
- "Windows": change how many sessions are open (1 to 8).

## Picking the odds and stake boxes (easiest)
Click "Pick" next to Odds selector, hover over the bet slip (a visual highlight box shows your target), then click the odds number in any pane.
Do the same for the stake box. The selector fills in by itself, and the line under the
buttons shows what it read, so you can check it is the slip's odds. If you change a
selector while "Keep updated" is ticked, untick and tick it again.

## Finding a field selector by hand
Press Ctrl+Shift+I inside a window to open dev tools, right-click the field in the
Elements panel, and choose Copy > Copy selector.

## Limits
- Mirroring finds elements by selector, so it can miss if the page builds different
  layouts per account. It falls back to the click position.
- It does not place or claim anything on its own. You act, the windows follow.
- Check the terms of any site you use it on. Many ban multiple accounts.

## Giving the app to a friend and being able to cut them off
Your own copy has no license files, so it always runs.
1. Host a licenses file you can edit from anywhere, for example a secret GitHub Gist named
   licenses.json (start from licenses.example.json). Use its "Raw" link without the long commit id,
   so your edits show up under the same link.
2. Make a copy of this folder for your friend (without node_modules) and add one file to it:
   license.config.json  (copy license.config.example.json and put your raw gist link as "url")
3. He runs npm install, then npm start. The app refuses to open and shows his computer's ID.
4. He sends you that ID. You run:  node make-license.js "Friend name" 30 THE-ID
   (30 = days of access, 0 = no expiry) and paste the printed line into "keys" in your gist.
5. He opens the app again and it works, on that computer only. Copies on other computers show
   their own ID and stay locked until you approve them.
To cut him off: change his entry to "active": false. The app checks at start and every 5 minutes,
so it closes within about 10 minutes. If he is offline it keeps working for 24 hours, then stops.
Tell your friend that the app checks in with this file, so it is not a surprise.
Without "machineLock" the license is a key in license.key instead (make-license.js without an ID).
This stops a normal user. Someone who knows JavaScript could edit the app files to remove the
check, so do not treat it as unbreakable.
