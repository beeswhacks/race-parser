// Moved type and interface definitions from extract.ts
interface Row {
  pos: number;
  no: string;
  class: string;
  pic: number | null;
  name: string | null;
  entry: string | null;
  time: string | null;
  best: string | null;
  on: number | null;
  laps: number | null;
  gap: string | null;
  diff: string | null;
  mph: number | null;
}

type Word = { str: string; x: number; y: number; midY: number };
type ColumnMap = { startX: number; endX: number; header: string }[];

export { Row, Word, ColumnMap };
