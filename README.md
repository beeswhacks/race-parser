This package converts a race classification PDF into JSON array of results.

# Problem

Race sheets are provided as PDFs, which are easy for humans to read but messy for code. A PDF stores text conten as a set of string fragments with **(x, y)** coordinates. How these strings relate to teach other is obvious to humans but is not encoded in the PDF.

There are a few challenge to parsing these particular PDFs: the column order varies, columns are not consistently or perfectly aligned, and some columns overhang their headers.

# Approach

Firstly, we parse the text content of the PDF using `pdfjs-dist`, revealing every word in the document plus its baseline **(x, y)** coordinates.

The lines of the PDF are reconstructed by grouping words that have the same **y** coordinate.

We search for the line containing the column headers (POS, NO, NAME etc.) and use their **x** coordinate to establish horizontal buckets/anchors for each column.

We search for the result rows in the classification by looking for lines in the PDF that begin with a 1 or 2 digit number. Their **y** coordinates create vertical buckets/anchors for each row.

With both of these, we have a set of horizontal and vertical buckets - we have a **coordinate system.**

We loop through the result rows, assigning each word to a column by finding the one with the closest y-coordinate. We make some adjustments here so that words that are extremely right or left aligned are assigned to the correct columns.q

At this point, our task is complete - we've parsed unstructured string fragments with coordinates into rows and columns!

## Weaknesses & assumptions
* Works only on **vector‑text** PDFs (scans would need OCR).
* Relies on the presence and correct spelling of the header tokens.
* Assumes `POS` is the first column and is numeric (1–2 digits).
* Ignores any fields beyond `POS, NO, CL, PIC, NAME, ENTRY, BEST, TIME, ON, LAPS, GAP, DIFF, MPH`.
* Heuristic to correctly scan `PIC` (single‑digit, right‑aligned) could mis‑label edge‑cases.

# Usage

## CLI

You have two options for running from the command line: install the package locally and run it in the repo, or install it globally and run it from anywhere.

### Local

1. Clone the repo and `npm install`.
2. Run `npm start -- /path/to/pdf.pdf`.

```shell
# setup
npm install           # setup
npm start -- --help   # usage
npm start -- in.pdf out.json
```

### Global

Alternatively:
1. Clone the repo and `npm install -g`.
2. Run `race-parser` as a CLI tool.

```shell
# setup
npm install -g      # setup
race-parser --help  # usage  
race-parser in.pdf out.json
```

## JavaScript module

You can also import the module and call it from a Node application, AWS Lambda function etc.

```javascript
import { parseRacePdf } from "race-parser/dist/parseRacePdf.js";
const rows = await parseRacePdf(buffer);
```

If it would be useful, it's possible to publish this package to the npm registry (it's a free service). This hosts the package on npm and abstracts away some of the details of installing and importing the package. So you could install it using `npm i race-parser`, and call it as follows:

```javascript
import { parseRacePdf } from "race-parser";
```