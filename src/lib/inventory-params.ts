/**
 * Inventory filters <-> URL. Shared by the page, the toolbar and CSV export so
 * "export the current view" exports exactly what's on screen.
 *
 *   q=hood  cat=<id>,<id>|none  loc=<id>,<id>  low=1  out=1 (checkoutable)
 *   show=archived  sort=name|quantity|category|updated|field:<id>  dir=asc|desc
 *   view=grid|table  page=2  f=<fieldId>~<op>~<value> (repeatable)
 */
export const SORTS = {
  name: { label: "Name", defaultDir: "asc" },
  quantity: { label: "Quantity", defaultDir: "desc" },
  category: { label: "Category", defaultDir: "asc" },
  updated: { label: "Last updated", defaultDir: "desc" },
} as const;

export type BuiltInSort = keyof typeof SORTS;
export type Sort = BuiltInSort | `field:${string}`;
export type FieldFilter = { id: string; op: "eq" | "contains" | "gte" | "lte"; value: string };

export type InventoryParams = {
  q: string;
  categories: string[];
  locations: string[];
  lowStock: boolean;
  checkoutable: boolean;
  archived: boolean;
  sort: Sort;
  dir: "asc" | "desc";
  view: "grid" | "table";
  page: number;
  fieldFilters: FieldFilter[];
};

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function all(value: string | string[] | undefined) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function list(value: string | string[] | undefined) {
  return all(value).flatMap((v) => v.split(",")).filter(Boolean);
}
function single(value: string | string[] | undefined) {
  return all(value)[0] ?? "";
}

export function defaultDir(sort: Sort): "asc" | "desc" {
  return sort.startsWith("field:") ? "asc" : SORTS[sort as BuiltInSort].defaultDir;
}

export function parseInventoryParams(sp: SearchParams, fixedLocationId?: string): InventoryParams {
  const rawSort = single(sp.sort);
  const sort: Sort =
    rawSort in SORTS ? (rawSort as BuiltInSort) : rawSort.startsWith("field:") && UUID.test(rawSort.slice(6)) ? (rawSort as Sort) : "name";
  const rawDir = single(sp.dir);

  return {
    q: single(sp.q).trim().slice(0, 100),
    categories: list(sp.cat).filter((c) => c === "none" || UUID.test(c)),
    locations: fixedLocationId ? [fixedLocationId] : list(sp.loc).filter((l) => UUID.test(l)),
    lowStock: single(sp.low) === "1",
    checkoutable: single(sp.out) === "1",
    archived: single(sp.show) === "archived",
    sort,
    dir: rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir(sort),
    view: single(sp.view) === "table" ? "table" : "grid",
    page: Math.max(1, Number(single(sp.page)) || 1),
    fieldFilters: all(sp.f)
      .map((f) => {
        const [id, op, ...rest] = f.split("~");
        return { id, op, value: rest.join("~") } as FieldFilter;
      })
      .filter((f) => UUID.test(f.id) && ["eq", "contains", "gte", "lte"].includes(f.op) && f.value !== ""),
  };
}

export function inventorySearch(params: InventoryParams, { fixedLocation = false, includePage = true } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.categories.length) search.set("cat", params.categories.join(","));
  if (!fixedLocation && params.locations.length) search.set("loc", params.locations.join(","));
  if (params.lowStock) search.set("low", "1");
  if (params.checkoutable) search.set("out", "1");
  if (params.archived) search.set("show", "archived");
  if (params.sort !== "name") search.set("sort", params.sort);
  if (params.dir !== defaultDir(params.sort)) search.set("dir", params.dir);
  if (params.view !== "grid") search.set("view", params.view);
  for (const f of params.fieldFilters) search.append("f", `${f.id}~${f.op}~${f.value}`);
  if (includePage && params.page > 1) search.set("page", String(params.page));
  return search;
}

export function inventoryHref(basePath: string, params: InventoryParams, changes: Partial<InventoryParams> = {}, fixedLocation = false) {
  const search = inventorySearch({ ...params, ...changes }, { fixedLocation });
  return `${basePath}${search.size ? `?${search}` : ""}`;
}

/** Field filter values as the database expects (numbers/booleans typed). */
export function fieldFiltersForDb(filters: FieldFilter[], types: Record<string, string>) {
  return filters
    .filter((f) => types[f.id])
    .map((f) => {
      const type = types[f.id];
      let value: string | number | boolean = f.value;
      if (f.op === "eq" && type === "number") value = Number(f.value);
      if (f.op === "eq" && type === "boolean") value = f.value === "yes";
      return { id: f.id, op: f.op, value };
    });
}
