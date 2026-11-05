# Scheduled Tab Reloader

A privacy-first Firefox and Chrome extension for reloading selected tabs on a schedule. Choose
the interval and duration, for example every 2 minutes for 2 hours, and the schedule
stops automatically when it is done.

[Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/scheduled-tab-reloader/) · [Landing page](https://blueharborworks.github.io/scheduled-tab-reloader/)

## Privacy by design

Scheduled Tab Reloader does not read or modify website content. It does not request
host permissions, inject scripts into pages, use remote code, collect data, run
analytics, track users, or make network requests of its own.

Schedules and settings stay inside the browser. See [PRIVACY.md](PRIVACY.md) for the
complete privacy and permissions explanation.

## Permissions

- `tabs`: lists tab titles in the picker and reloads only the tabs you select.
- `alarms`: schedules reloads without keeping a background timer running.
- `storage`: keeps active schedules in `storage.session` and the last-used form
  values in `storage.local`.

These permissions do not grant access to the contents of the websites you visit.

## Features

- Reload one or more tabs at the same interval.
- Use seconds, minutes, or hours for the interval (at least 10 seconds in Firefox and
  30 seconds in Chrome, which does not fire extension alarms more often).
- Run for minutes, hours, days, or until manually stopped.
- See the next reload time and remaining reload count.
- Optionally bypass the cache with a hard reload.
- Stop individual schedules from the toolbar popup.

## Project layout

- `extension/`: the Manifest V3 extension. The manifest is the Firefox one;
  `scripts/build-chrome.mjs` derives the Chrome manifest (service worker background,
  no Gecko settings) at build time. The JavaScript is the same for both browsers.
- `test/`: unit tests using a fake WebExtension API and clock.
- `artwork/`: source artwork for the extension icon.
- `site/`: the project landing page (static HTML, no build step).
- `amo-metadata.json`: metadata used for the Firefox Add-ons listing.
- `store/`: Chrome Web Store listing text (`chrome-web-store.md`) and images.

## Development

Requires Node.js and npm.

```sh
npm install
npm test
npm run lint
npm run build          # Firefox: dist/scheduled_tab_reloader-<version>.zip
npm run build:chrome   # Chrome:  dist/chrome-mv3/ and dist/scheduled_tab_reloader-<version>-chrome.zip
```

To load it temporarily in Firefox, open
`about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select
`extension/manifest.json`.

To load it in Chrome, run `npm run build:chrome`, open `chrome://extensions`, turn on
**Developer mode**, choose **Load unpacked**, and select `dist/chrome-mv3`.

## License

[MIT](LICENSE)
