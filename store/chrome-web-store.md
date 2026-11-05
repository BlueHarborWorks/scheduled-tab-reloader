# Chrome Web Store submission: Scheduled Tab Reloader

Everything needed to submit Scheduled Tab Reloader in the Chrome Web Store Developer Dashboard
(https://chrome.google.com/webstore/devconsole). Text in code blocks is meant to be pasted as-is.

Published listing (item ID `jhlddaodljdnbpahmfloghgojmgcgpli`, first published 2026-11-04 as 1.1.0):
https://chromewebstore.google.com/detail/scheduled-tab-reloader/jhlddaodljdnbpahmfloghgojmgcgpli

## Before you start

- The privacy policy URL below must show the current `PRIVACY.md`, so it has to be on `main` on GitHub.
- Build the package: `npm run build:chrome` creates `dist/scheduled_tab_reloader-1.1.0-chrome.zip`.
- Do not create API keys, change account settings other than those listed here, or put the account
  owner's email address in any public field.

## 1. Account (one time, shared by all items)

Skip if already done for Wordshift. Dashboard > **Account** (Settings):

- **Publisher name**: `Blue Harbor Works`
- **Contact email**: must be verified before an item can be submitted. If it is missing or not
  verified, stop and ask the account owner. Do not enter an address yourself.
- **Trader / non-trader declaration** (EU Digital Services Act): a legal declaration for the account
  owner to make. Stop and ask if it has not been answered.

## 2. Create the item

**+ New item** > upload `dist/scheduled_tab_reloader-1.1.0-chrome.zip`. Expected: no errors. The
package is Manifest V3, version 1.1.0, `minimum_chrome_version` 120, background service worker,
permissions `alarms`, `storage`, `tabs`, no host permissions, no content scripts, no remote code.
The JavaScript is plain, unminified source.

## 3. Store listing tab

**Description**

```
Reload one or more tabs on a schedule, with no access to the contents of the websites you visit.

Pick tabs in the current window, set how often they reload (seconds, minutes or hours, at least every 30 seconds) and for how long (minutes, hours, days, or until you stop it). For example: every 2 minutes for 2 hours.

The popup shows each active schedule with the next reload time, how many reloads are left, and a Stop button. The toolbar badge shows how many schedules are running.

Options: hard reload (bypass cache), and select all tabs in the window. Closing a tab removes it from its schedule. Schedules end when the browser closes. Reloads missed while the computer was asleep are not replayed in a burst.

Privacy by design
- Does not read or modify website content
- No host permissions and no scripts injected into pages
- No analytics, tracking, data collection, remote code, or network requests of its own
- Schedules and settings stay in your browser

Permissions: tabs (show tab titles in the picker and reload the selected tabs), alarms (schedule the reloads), storage (keep active schedules and the last-used settings locally).

Open source under the MIT License.
```

- **Category**: Productivity > Tools
- **Language**: English
- **Store icon** (128x128): `extension/icons/icon-128.png`
- **Screenshots** (1280x800), in this order:
  1. `store/chrome/screenshot-1-schedule-light.png`
  2. `store/chrome/screenshot-2-schedule-dark.png`
- **Small promo tile** (440x280): `store/chrome/promo-small-440x280.png`
- **Marquee promo tile**: leave empty (optional).
- **Homepage URL**: `https://blueharborworks.github.io/scheduled-tab-reloader/`
- **Support URL**: `https://github.com/BlueHarborWorks/scheduled-tab-reloader/issues`
- **Mature content**: No.

## 4. Privacy tab

**Single purpose description**

```
Reload the tabs the user selects on a schedule the user sets (how often and for how long).
```

**Permission justifications**

`tabs`

```
Lists the titles and icons of the tabs in the current window so the user can choose which ones to reload, and reloads the chosen tabs. The extension does not read or change page content and has no host permissions.
```

`alarms`

```
Schedules each reload with a periodic alarm, so no background timer has to keep running between reloads.
```

`storage`

```
Keeps active schedules (tab ids, interval, and timing) in storage.session, which is cleared when the browser closes, and the last-used form values in storage.local.
```

**Remote code**: No, I am not using remote code.

**Data usage**. Chrome's User Data FAQ says data handled only on the device still has to be
disclosed. Recommended answers:

- [x] **Web history**: the popup lists the titles and addresses of open tabs so the user can pick
  which ones to reload. They are shown only while the popup is open and are never stored or
  transmitted.
- All other categories: unchecked.
- Certify all three statements (no sale or transfer to third parties, no use unrelated to the single
  purpose, no use for creditworthiness or lending).

**Privacy policy URL**:
`https://github.com/BlueHarborWorks/scheduled-tab-reloader/blob/main/PRIVACY.md`

## 5. Distribution tab

- **Payments**: Free
- **Visibility**: Public
- **Regions**: All regions

## 6. Test instructions tab (for reviewers)

```
No account or credentials are needed.
Open any web page, click the toolbar button, keep the current tab ticked, set "Reload every 30 seconds" for "1 minutes", and click Start. The tab reloads twice and the schedule disappears from "Active schedules". Stop ends a schedule early.
Source code: https://github.com/BlueHarborWorks/scheduled-tab-reloader (plain JavaScript; npm test runs the unit tests).
```

## 7. Submit

Click **Submit for review**. Leave "publish automatically after approval" on unless the account owner
asks otherwise. Report back the status shown (normally "Pending review") and any warnings, quoted
exactly.
