/**
 * Avery label sheet layouts (all measurements in millimetres).
 * Sources: Avery template specifications for each product number.
 */
export type LabelTemplate = {
  id: string;
  name: string;
  description: string;
  page: { width: number; height: number; css: string };
  columns: number;
  rows: number;
  label: { width: number; height: number };
  margin: { top: number; left: number };
  /** Distance from the start of one label to the next. */
  pitch: { x: number; y: number };
};

const IN = 25.4;
const LETTER = { width: 8.5 * IN, height: 11 * IN, css: "letter" };
const A4 = { width: 210, height: 297, css: "A4" };

export const LABEL_TEMPLATES: LabelTemplate[] = [
  {
    id: "5160",
    name: "Avery 5160 / 8160",
    description: '30 per sheet · 1" × 2⅝" · US Letter',
    page: LETTER,
    columns: 3,
    rows: 10,
    label: { width: 2.625 * IN, height: 1 * IN },
    margin: { top: 0.5 * IN, left: 0.1875 * IN },
    pitch: { x: 2.75 * IN, y: 1 * IN },
  },
  {
    id: "5163",
    name: "Avery 5163 / 8163",
    description: '10 per sheet · 2" × 4" · US Letter',
    page: LETTER,
    columns: 2,
    rows: 5,
    label: { width: 4 * IN, height: 2 * IN },
    margin: { top: 0.5 * IN, left: 0.15625 * IN },
    pitch: { x: 4.1875 * IN, y: 2 * IN },
  },
  {
    id: "5164",
    name: "Avery 5164 / 8164",
    description: '6 per sheet · 3⅓" × 4" · US Letter',
    page: LETTER,
    columns: 2,
    rows: 3,
    label: { width: 4 * IN, height: (10 / 3) * IN },
    margin: { top: 0.5 * IN, left: 0.15625 * IN },
    pitch: { x: 4.1875 * IN, y: (10 / 3) * IN },
  },
  {
    id: "L7160",
    name: "Avery L7160",
    description: "21 per sheet · 63.5 × 38.1 mm · A4",
    page: A4,
    columns: 3,
    rows: 7,
    label: { width: 63.5, height: 38.1 },
    margin: { top: 15.15, left: 7.2 },
    pitch: { x: 66, y: 38.1 },
  },
  {
    id: "L7163",
    name: "Avery L7163",
    description: "14 per sheet · 99.1 × 38.1 mm · A4",
    page: A4,
    columns: 2,
    rows: 7,
    label: { width: 99.1, height: 38.1 },
    margin: { top: 15.15, left: 4.65 },
    pitch: { x: 101.6, y: 38.1 },
  },
];
