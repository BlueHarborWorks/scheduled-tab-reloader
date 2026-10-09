# Scheduled Tab Reloader for Firefox

A privacy-first Firefox extension for reloading selected tabs on a schedule. Choose
the interval and duration, for example every 2 minutes for 2 hours, and the schedule
stops automatically when it is done.

[Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/scheduled-tab-reloader/) · [Landing page](https://blueharborworks.github.io/scheduled-tab-reloader/)

## Privacy by design

Scheduled Tab Reloader does not read or modify website content. It does not request
host permissions, inject scripts into pages, use remote code, collect data, run
analytics, track users, or make network requests of its own.

Schedules and settings stay inside Firefox. See [PRIVACY.md](PRIVACY.md) for the
complete privacy and permissions explanation.

## Permissions

- `tabs`: lists tab titles in the picker and reloads only the tabs you select.
- `alarms`: schedules reloads without keeping a background timer running.
- `storage`: keeps active schedules in `storage.session` and the last-used form
  values in `storage.local`.

These permissions do not grant access to the contents of the websites you visit.

## Features

- Reload one or more tabs at the same interval.
- Use seconds, minutes, or hours for the interval.
- Run for minutes, hours, days, or until manually stopped.
- See the next reload time and remaining reload count.
- Optionally bypass the cache with a hard reload.
- Stop individual schedules from the toolbar popup.

## Project layout

- `extension/`: the Manifest V3 Firefox extension.
- `test/`: unit tests using a fake WebExtension API and clock.
- `artwork/`: source artwork for the extension icon.
- `site/`: the project landing page (static HTML, no build step).
- `amo-metadata.json`: metadata used for the Firefox Add-ons listing.

## Development

Requires Node.js and npm.

```sh
npm install
npm test
npm run lint
npm run build
```

To load it temporarily in Firefox, open
`about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select
`extension/manifest.json`.

## License

[MIT](LICENSE)
