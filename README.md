This package parses a PDF of a race classification sheet to JSON array.

# Problem

Race sheets are provided as PDFs, which are easy for humans but messy for computers to read. The text content of a PDF is essentially just a set of string fragments with **(x, y)** coordinates. How these strings relate to teach other is apparent to humans but is not encoded in the PDF.

There are a few challenge to parsing these particular PDFs: columns are not always in the same order, columns are not consistently aligned, and some columns overhang their headers.

# Approach

Firstly, we parse the text content of the PDF using `pdfjs-dist`, revealing every word in the document plus its baseline **(x, y)** coordinates.

The lines of the PDF are reconstructed by grouping words that have the same **y** coordinate.

We search for the line containing the column headers (POS, NO, NAME etc.) and use their **x** coordinate to establish horizontal buckets/anchors for each column.

We search for the result rows in the classification by looking for lines in the PDF that begin with a 1 or 2 digit number. Their **y** coordinates create vertical buckets/anchors for each row.

With both of these, we have a set of horizontal and vertical buckets - we have a **coordinate system.**

We loop through the result rows, assigning each word to a column by finding the one with the closest y-coordinate. We make some adjustments here so that words that are extremely right or left aligned are assigned to the correct columns.q

At this point, our task is complete - we've parsed unstructured string fragments with coordinates into rows and columns!

# Weaknesses
- The PDFs are not in an exactly consistent format, which is challenging. Some tweaks have had to be made to 
- Assumes PDFs are vector text, not scanned image. To parse a scanned image, you would need to add optical character recognition (OCR).
- The parser relies on a few assumptions in the data. If these assumptions are violated then the parser will behave unexepectedly. For example:
    - The POS column is used to identify rows, assuming they are the first column and contain a 1 or 2 digit number.
    - Only the fields POS, NO, CL, PIC, NAME, ENTRY, BEST, TIME, ON, LAPS, GAP, DIFF, and MPH are parsed. Other columns are ignored.
- The parser uses the column headers from the sheet to name the keys in the output JSON. If NO was misspelt NUM, the output key would be NUM, and NO would be undefined. This could be easily accomodated by creating a mapping e.g. `[NUM, NO] -> NO`.

# Usage

Install globally and run as CLI