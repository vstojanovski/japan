Third-party libraries, loaded only when you import a file:

- `xlsx.full.min.js`: SheetJS Community Edition 0.18.5, Apache License 2.0 (https://sheetjs.com). Reads .xls, .xlsx and the HTML/XML files banks save as .xls.
- `pdf.min.js`, `pdf.worker.min.js`: PDF.js 3.11.174 by Mozilla, Apache License 2.0 (https://mozilla.github.io/pdf.js/). Reads the text of PDF statements.

They are bundled here, rather than loaded from a CDN, so importing works offline and on a home server.
