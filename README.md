# MarkEdit-version-browser

Browse, compare, and restore saved versions of the current document. Local versions can also be deleted.

## Installation

Install this extension from the [MarkEdit Extension Registry](https://markedit-app.github.io/extensions/#markedit-version-browser).

## How to Use

Open **Extensions > Browse Versions** in MarkEdit. Select a saved version to compare it with the current document, then switch between unified and split layouts as needed. Unchanged sections can be expanded directly in the diff.

Local delete operations require confirmation. The browser refreshes automatically after a version is deleted.

## Settings

In [settings.json](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization#advanced-settings), define a settings node named `extension.markeditVersionBrowser`. The default settings are:

```json
{
  "extension.markeditVersionBrowser": {
    "wrapLines": true,
    "showLineNumbers": true,
    "diffIndicators": "classic",
    "lineDiff": "word-alt",
    "hunkSeparators": "line-info",
    "expandUnchanged": false,
    "expansionLineCount": 20
  }
}
```

- `wrapLines`: Wrap long lines instead of scrolling horizontally.
- `showLineNumbers`: Show line numbers in the diff gutter.
- `diffIndicators`: Line indicators: `classic`, `bars`, or `none`.
- `lineDiff`: Changed-text granularity: `word-alt`, `word`, `char`, or `none`.
- `hunkSeparators`: Hunk separator style: `simple`, `metadata`, `line-info`, or `line-info-basic`.
- `expandUnchanged`: Expand unchanged sections by default.
- `expansionLineCount`: Number of unchanged lines to reveal at a time, clamped from 1 to 100.

## Building

```
yarn install
yarn test
yarn build
```

`yarn build` also deploys the extension to your local MarkEdit installation.
