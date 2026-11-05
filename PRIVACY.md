# Privacy

Scheduled Tab Reloader is designed to do one job without observing your browsing. It works the same
way in Firefox and in Chrome.

## Data collection

The extension does not collect, transmit, sell, or share personal data. It contains
no analytics, telemetry, advertising, tracking, remote code, or network requests of
its own.

## Website access

The extension does not request host permissions and does not inject scripts into
websites. It cannot read or modify the contents of the pages you visit.

## Local storage

Active schedules (tab ids, interval, and timing) are stored in the browser's
`storage.session` and disappear when the browser closes. The last-used form values
are stored in `storage.local` for convenience. This information stays inside the
browser.

## Tab titles and addresses

To let you choose which tabs to reload, the popup lists the titles, addresses, and
icons of the tabs in the current window. They are shown only while the popup is open
and are never stored or sent anywhere.

## Permissions

- `tabs` is used to show tab titles in the picker and reload selected tabs. It does
  not give access to page content.
- `alarms` is used to schedule reloads.
- `storage` is used for active schedules and form preferences.

No account is required.

## Contact

Questions and reports: https://github.com/BlueHarborWorks/scheduled-tab-reloader/issues
