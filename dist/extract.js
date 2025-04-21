#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
// ---------- CLI ----------
if (process.argv.length < 3) {
    console.error('Usage: extract <file.pdf>');
    process.exit(1);
}
const pdfPath = process.argv[2];
main(pdfPath).catch((err) => {
    console.error(err);
    process.exit(1);
});
// ---------- Helpers ----------
const getColumnMap = (lines, pageWidth) => {
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
const getColumnForWord = (word, columnMap) => {
    if (columnMap === null) {
        return null;
    }
    const { column } = columnMap.reduce((acc, curr) => {
        const distance = Math.abs(curr.startX - word.x);
        if (distance < acc.distance) {
            return { distance: distance, column: curr };
        }
        return acc;
    }, { distance: Infinity, column: columnMap[0] });
    // PIC is usually only single digit and right aligned, so is often closest to the NAME column.
    // We run an extra check to see if the column is determined to be NAME but the content is only digits.
    // If it is, it's probably PIC
    if (column.header === 'NAME' && /^\d+$/.test(word.str)) {
        return columnMap.find((column) => column.header === 'PIC');
    }
    return column;
};
const finisherRegexes = new Map([
    ['POS', /^\s*([\d]{1,2})\s*$/],
    ['NO', /^\s*([\d]{1,3})[\s*]?$/],
]);
// ---------- Main ----------
async function main(file) {
    const data = new Uint8Array(await fs.promises.readFile(file)); // Convert Buffer to Uint8Array
    const pdf = await getDocument({ data }).promise;
    const rows = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const txt = await page.getTextContent({ includeMarkedContent: false });
        // Parse words with coordinates from PDF
        const words = txt.items
            .map((i) => {
            const { str, transform } = i;
            const [, , , scaleY, x, y] = transform;
            const midY = y + scaleY / 2;
            return { str: str.trim(), x, y: Math.floor(y), midY };
        })
            .filter((w) => w.str);
        // Reconstruct lines of PDF by grouping by Y coordinate and sorting by X
        const lines = {};
        for (const w of words)
            (lines[w.y] ??= []).push(w);
        for (const k in lines)
            lines[k].sort((a, b) => a.x - b.x);
        // Get a map of start and end X coordinates for each column
        const columnMap = getColumnMap(lines, page.getViewport({ scale: 1 }).width);
        const positions = words
            .filter((word) => {
            const posColumn = columnMap?.find((c) => c.header === 'POS');
            if (!posColumn) {
                throw new Error('POS column not found.');
            }
            const xPositionMatch = word.x >= posColumn?.startX && word.x <= posColumn?.endX;
            const regexMatch = finisherRegexes.get('POS')?.test(word.str);
            return xPositionMatch && regexMatch;
        })
            .sort((a, b) => a.y - b.y)
            .map((position, index, positions) => ({
            position: position.str,
            startY: position.y,
            endY: positions[index + 1] ? positions[index + 1].y : position.y + 15,
        }));
        const raceDataRecords = {};
        for (const w of words) {
            const position = positions.find((p) => w.midY < p.endY && w.midY >= p.startY);
            //   const column = columnMap?.find((c) => w.x < c.endX && w.x >= c.startX);
            if (position) {
                (raceDataRecords[position.position] ??= []).push(w);
            }
        }
        const parsedRecords = Object.entries(raceDataRecords).map(([pos, words]) => {
            const entries = words.map((w) => {
                const key = getColumnForWord(w, columnMap)?.header.toLowerCase();
                const value = w.str;
                return [key, value];
            });
            const row = Object.fromEntries(entries);
            return row;
        });
        rows.push(...parsedRecords);
    }
    // ---------- Output ----------
    const out = path.basename(file, path.extname(file)) + '.json';
    await fs.promises.writeFile(out, JSON.stringify(rows, null, 2));
    console.log(`✓  ${out}`);
}
//# sourceMappingURL=extract.js.map