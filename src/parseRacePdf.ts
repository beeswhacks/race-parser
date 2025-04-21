import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import { ColumnMap, Row, Word } from './Types.js';

// ---------- Helpers ----------
const getColumnMap = (lines: Record<number, Word[]>, pageWidth: number): null | ColumnMap => {
  for (const line of Object.values(lines)) {
    const headerFields = line.filter((w) => /^(POS|NO|CL|PIC|NAME|ENTRY|BEST|TIME|ON|LAPS|GAP|DIFF|MPH)$/i.test(w.str));
    if (headerFields.length >= 4) {
      const headerPositions = headerFields
        .map((word) => ({
          header: word.str,
          startX: Math.floor(word.x),
        }))
        .sort((a, b) => a.startX - b.startX);

      return headerPositions.map((header, index) => {
        const nextHeader = headerPositions[index + 1];
        return {
          ...header,
          endX: nextHeader === undefined ? pageWidth : nextHeader.startX,
        };
      });
    }
  }
  return null;
};

const getColumnForWord = (word: Word, columnMap: ColumnMap | null) => {
  if (columnMap === null) {
    return null;
  }
  const { column } = columnMap.reduce(
    (acc, curr) => {
      const distance = Math.abs(curr.startX - word.x);
      if (distance < acc.distance) {
        return { distance: distance, column: curr };
      }
      return acc;
    },
    { distance: Infinity, column: columnMap[0] },
  );
  // PIC is usually only single digit and right aligned, so is often closest to the NAME column.
  // We run an extra check to see if the column is determined to be NAME but the content is only digits.
  // If it is, it's probably PIC
  if (column.header === 'NAME' && /^\d+$/.test(word.str)) {
    return columnMap.find((column) => column.header === 'PIC');
  }
  return column;
};

export default async function parseRacePdf(data: Uint8Array | Buffer): Promise<Row[]> {
  const pdf = await getDocument({ data }).promise;

  const rows: Row[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const txt = await page.getTextContent({ includeMarkedContent: false });

    // Parse words with coordinates from PDF
    const words: Word[] = (txt.items as TextItem[])
      .map((i) => {
        const { str, transform } = i;
        const [, , , scaleY, x, y] = transform;
        return { str: str.trim(), x, y: Math.floor(y), midY: y + scaleY / 2 };
      })
      .filter((w) => w.str);

    // Reconstruct lines of PDF by grouping by Y coordinate and sorting by X
    const lines: Record<number, Word[]> = {};
    for (const w of words) (lines[w.y] ??= []).push(w);
    for (const k in lines) lines[k].sort((a, b) => a.x - b.x);

    // Get a map of columns with x and y coordinates
    const columnMap = getColumnMap(lines, page.getViewport({ scale: 1 }).width);

    // Get map of result rows with x and y coordinates
    const resultRowMap = words
      .filter((word) => {
        const posColumn = columnMap?.find((c) => c.header === 'POS');
        if (!posColumn) {
          throw new Error('POS column not found.');
        }
        const xPositionMatch = word.x >= posColumn?.startX && word.x <= posColumn?.endX;
        const POSRegex = /^\s*([\d]{1,2})\s*$/;
        const regexMatch = POSRegex.test(word.str);
        return xPositionMatch && regexMatch;
      })
      .sort((a, b) => a.y - b.y)
      .map((position, index, positions) => ({
        position: position.str,
        startY: position.y,
        endY: positions[index + 1] ? positions[index + 1].y : position.y + 15,
      }));

    // Pick out words that belong to result rows and data columns - ignore all other text
    const rawResults: Record<string, Word[]> = {};
    for (const w of words) {
      const position = resultRowMap.find((p) => w.midY < p.endY && w.midY >= p.startY);
      if (position) {
        (rawResults[position.position] ??= []).push(w);
      }
    }

    // Parse the result rows to objects
    const parsedResults = Object.entries(rawResults).map(([pos, words]) => {
      const entries = words.map((w) => {
        const key = getColumnForWord(w, columnMap)?.header.toLowerCase();
        const value = w.str;
        return [key, value];
      });
      const row = Object.fromEntries(entries);
      return row;
    });

    rows.push(...parsedResults);
  }

  return rows;
}
