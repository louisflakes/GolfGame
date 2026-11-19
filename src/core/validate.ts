// Parses untrusted input (e.g. a decoded share code) into a clean Hole.
// Unknown keys are dropped. Structural problems are errors; design problems are warnings.

import { pointInPolygon, polylineLength } from "./geometry";
import {
  HOLE_FORMAT,
  HOLE_VERSION,
  SURFACE_IDS,
  type Hole,
  type Par,
  type Pin,
  type ProceduralSettings,
  type Route,
  type Shape,
  type ShapeShaping,
  type SparseGrid,
  type SurfaceId,
  type Tee,
  type Vec2,
} from "./types";

export const LIMITS = {
  minBound: 20,
  maxBound: 2000,
  maxTees: 8,
  maxPins: 8,
  maxShapes: 300,
  maxOutlinePoints: 256,
  maxRoutePoints: 64,
  maxIdLength: 64,
  maxNameLength: 60,
  maxAuthorLength: 40,
  maxDescriptionLength: 500,
  maxGridChunks: 10000,
  maxChunkSize: 256,
} as const;

export interface Issue {
  path: string;
  message: string;
}

export interface ParseResult {
  hole?: Hole;
  errors: Issue[];
  warnings: Issue[];
}

/** Suggested par from playing length in meters (roughly men's guidelines). */
export function suggestPar(lengthMeters: number): Par {
  if (lengthMeters <= 230) return 3;
  if (lengthMeters <= 430) return 4;
  if (lengthMeters <= 630) return 5;
  return 6;
}

/** Playing length along the route, in meters. */
export function holeLength(hole: Pick<Hole, "route">): number {
  return polylineLength(hole.route.points.map((p) => p.position));
}

class Parser {
  errors: Issue[] = [];
  warnings: Issue[] = [];

  error(path: string, message: string): undefined {
    this.errors.push({ path, message });
    return undefined;
  }

  warn(path: string, message: string): void {
    this.warnings.push({ path, message });
  }

  obj(v: unknown, path: string): Record<string, unknown> | undefined {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return this.error(path, "must be an object");
    return v as Record<string, unknown>;
  }

  arr(v: unknown, path: string, min: number, max: number): unknown[] | undefined {
    if (!Array.isArray(v)) return this.error(path, "must be an array");
    if (v.length < min) return this.error(path, `must have at least ${min} item(s)`);
    if (v.length > max) return this.error(path, `must have at most ${max} items`);
    return v;
  }

  num(v: unknown, path: string, min = -Infinity, max = Infinity): number | undefined {
    if (typeof v !== "number" || !Number.isFinite(v)) return this.error(path, "must be a finite number");
    if (v < min || v > max) return this.error(path, `must be between ${min} and ${max}`);
    return v;
  }

  int(v: unknown, path: string, min: number, max: number): number | undefined {
    const n = this.num(v, path, min, max);
    if (n !== undefined && !Number.isInteger(n)) return this.error(path, "must be an integer");
    return n;
  }

  str(v: unknown, path: string, maxLength: number, allowEmpty = false): string | undefined {
    if (typeof v !== "string") return this.error(path, "must be a string");
    if (!allowEmpty && v.trim().length === 0) return this.error(path, "must not be empty");
    if (v.length > maxLength) return this.error(path, `must be at most ${maxLength} characters`);
    return v;
  }

  optStr(v: unknown, path: string, maxLength: number): string | undefined {
    return v === undefined ? undefined : this.str(v, path, maxLength, true);
  }

  vec2(v: unknown, path: string, min = -Infinity, max = Infinity): Vec2 | undefined {
    if (!Array.isArray(v) || v.length !== 2) return this.error(path, "must be [x, z]");
    const x = this.num(v[0], `${path}[0]`, min, max);
    const z = this.num(v[1], `${path}[1]`, min, max);
    return x === undefined || z === undefined ? undefined : [x, z];
  }
}

export function parseHole(input: unknown): ParseResult {
  const p = new Parser();
  const hole = parseRoot(p, input);
  if (hole && p.errors.length === 0) checkDesign(p, hole);
  return p.errors.length === 0 && hole
    ? { hole, errors: [], warnings: p.warnings }
    : { errors: p.errors, warnings: p.warnings };
}

function parseRoot(p: Parser, input: unknown): Hole | undefined {
  const o = p.obj(input, "hole");
  if (!o) return undefined;

  if (o.format !== HOLE_FORMAT) p.error("format", `must be "${HOLE_FORMAT}"`);
  if (o.version !== HOLE_VERSION) p.error("version", `unsupported version ${String(o.version)}`);

  const meta = parseMeta(p, o.meta);
  const boundsObj = p.obj(o.bounds, "bounds");
  const width = boundsObj && p.num(boundsObj.width, "bounds.width", LIMITS.minBound, LIMITS.maxBound);
  const length = boundsObj && p.num(boundsObj.length, "bounds.length", LIMITS.minBound, LIMITS.maxBound);
  const inBounds = (v: unknown, path: string) => {
    const vec = p.vec2(v, path);
    if (vec && width !== undefined && length !== undefined) {
      if (vec[0] < 0 || vec[0] > width || vec[1] < 0 || vec[1] > length) {
        return p.error(path, "must be inside the hole bounds");
      }
    }
    return vec;
  };

  const tees = mapArr(p, o.tees, "tees", 1, LIMITS.maxTees, (v, path) => parseTee(p, v, path, inBounds));
  const pins = mapArr(p, o.pins, "pins", 1, LIMITS.maxPins, (v, path) => parsePin(p, v, path, inBounds));
  const activePinId = p.str(o.activePinId, "activePinId", LIMITS.maxIdLength);
  const route = parseRoute(p, o.route, inBounds);
  const shapes = mapArr(p, o.shapes, "shapes", 0, LIMITS.maxShapes, (v, path) => parseShape(p, v, path));
  const procedural = parseProcedural(p, o.procedural);
  const overrides = parseOverrides(p, o.overrides);

  if (
    !meta || width === undefined || length === undefined || !tees || !pins || activePinId === undefined ||
    !route || !shapes || !procedural || !overrides
  ) {
    return undefined;
  }

  const hole: Hole = {
    format: HOLE_FORMAT,
    version: HOLE_VERSION,
    meta,
    bounds: { width, length },
    tees,
    pins,
    activePinId,
    route,
    shapes,
    procedural,
    overrides,
  };

  checkUniqueIds(p, hole);
  if (!pins.some((pin) => pin.id === activePinId)) p.error("activePinId", "must match a pin id");
  return hole;
}

function mapArr<T>(
  p: Parser,
  v: unknown,
  path: string,
  min: number,
  max: number,
  fn: (item: unknown, path: string) => T | undefined,
): T[] | undefined {
  const items = p.arr(v, path, min, max);
  if (!items) return undefined;
  const out: T[] = [];
  let ok = true;
  items.forEach((item, i) => {
    const r = fn(item, `${path}[${i}]`);
    if (r === undefined) ok = false;
    else out.push(r);
  });
  return ok ? out : undefined;
}

function parseMeta(p: Parser, v: unknown): Hole["meta"] | undefined {
  const o = p.obj(v, "meta");
  if (!o) return undefined;
  const id = p.str(o.id, "meta.id", LIMITS.maxIdLength);
  const name = p.str(o.name, "meta.name", LIMITS.maxNameLength);
  const author = p.optStr(o.author, "meta.author", LIMITS.maxAuthorLength);
  const description = p.optStr(o.description, "meta.description", LIMITS.maxDescriptionLength);
  const par = o.par === 3 || o.par === 4 || o.par === 5 || o.par === 6 ? o.par : p.error("meta.par", "must be 3, 4, 5 or 6");
  const createdAt = p.str(o.createdAt, "meta.createdAt", 40);
  if (createdAt !== undefined && Number.isNaN(Date.parse(createdAt))) p.error("meta.createdAt", "must be an ISO date");
  if (id === undefined || name === undefined || par === undefined || createdAt === undefined) return undefined;
  const meta: Hole["meta"] = { id, name, par, createdAt };
  if (author !== undefined) meta.author = author;
  if (description !== undefined) meta.description = description;
  return meta;
}

type InBounds = (v: unknown, path: string) => Vec2 | undefined;

function parseTee(p: Parser, v: unknown, path: string, inBounds: InBounds): Tee | undefined {
  const o = p.obj(v, path);
  if (!o) return undefined;
  const id = p.str(o.id, `${path}.id`, LIMITS.maxIdLength);
  const name = p.str(o.name, `${path}.name`, LIMITS.maxNameLength);
  const position = inBounds(o.position, `${path}.position`);
  const heading = p.num(o.heading, `${path}.heading`, -2 * Math.PI, 2 * Math.PI);
  const size = p.vec2(o.size, `${path}.size`, 1, 50);
  if (id === undefined || name === undefined || !position || heading === undefined || !size) return undefined;
  return { id, name, position, heading, size };
}

function parsePin(p: Parser, v: unknown, path: string, inBounds: InBounds): Pin | undefined {
  const o = p.obj(v, path);
  if (!o) return undefined;
  const id = p.str(o.id, `${path}.id`, LIMITS.maxIdLength);
  const position = inBounds(o.position, `${path}.position`);
  if (id === undefined || !position) return undefined;
  return { id, position };
}

function parseRoute(p: Parser, v: unknown, inBounds: InBounds): Route | undefined {
  const o = p.obj(v, "route");
  if (!o) return undefined;
  const points = mapArr(p, o.points, "route.points", 2, LIMITS.maxRoutePoints, (item, path) => {
    const po = p.obj(item, path);
    if (!po) return undefined;
    const position = inBounds(po.position, `${path}.position`);
    const width = p.num(po.width, `${path}.width`, 1, 200);
    return position && width !== undefined ? { position, width } : undefined;
  });
  return points ? { points } : undefined;
}

function parseShape(p: Parser, v: unknown, path: string): Shape | undefined {
  const o = p.obj(v, path);
  if (!o) return undefined;
  const id = p.str(o.id, `${path}.id`, LIMITS.maxIdLength);
  const surface = (SURFACE_IDS as readonly unknown[]).includes(o.surface)
    ? (o.surface as SurfaceId)
    : p.error(`${path}.surface`, `must be one of ${SURFACE_IDS.join(", ")}`);
  const outline = mapArr(p, o.outline, `${path}.outline`, 3, LIMITS.maxOutlinePoints, (item, ip) =>
    p.vec2(item, ip, -LIMITS.maxBound, 2 * LIMITS.maxBound),
  );
  const edgeSoftness = p.num(o.edgeSoftness, `${path}.edgeSoftness`, 0, 20);
  const shaping = o.shaping === undefined ? undefined : parseShaping(p, o.shaping, `${path}.shaping`);
  if (id === undefined || surface === undefined || !outline || edgeSoftness === undefined) return undefined;
  if (o.shaping !== undefined && !shaping) return undefined;
  const shape: Shape = { id, surface, outline, edgeSoftness };
  if (shaping) shape.shaping = shaping;
  return shape;
}

function parseShaping(p: Parser, v: unknown, path: string): ShapeShaping | undefined {
  const o = p.obj(v, path);
  if (!o) return undefined;
  switch (o.kind) {
    case "green": {
      const undulation = p.num(o.undulation, `${path}.undulation`, 0, 1);
      const raise = p.num(o.raise, `${path}.raise`, -5, 5);
      const tilt = o.tilt === undefined ? undefined : p.vec2(o.tilt, `${path}.tilt`, -0.1, 0.1);
      if (undulation === undefined || raise === undefined || (o.tilt !== undefined && !tilt)) return undefined;
      return tilt ? { kind: "green", undulation, tilt, raise } : { kind: "green", undulation, raise };
    }
    case "bunker": {
      const depth = p.num(o.depth, `${path}.depth`, 0, 5);
      const lip = p.num(o.lip, `${path}.lip`, 0, 3);
      return depth === undefined || lip === undefined ? undefined : { kind: "bunker", depth, lip };
    }
    case "water": {
      const waterLevel = p.num(o.waterLevel, `${path}.waterLevel`, -50, 200);
      const bankSteepness = p.num(o.bankSteepness, `${path}.bankSteepness`, 0, 1);
      return waterLevel === undefined || bankSteepness === undefined
        ? undefined
        : { kind: "water", waterLevel, bankSteepness };
    }
    case "pad": {
      const raise = p.num(o.raise, `${path}.raise`, -5, 5);
      return raise === undefined ? undefined : { kind: "pad", raise };
    }
    case "none":
      return { kind: "none" };
    default:
      return p.error(`${path}.kind`, "must be green, bunker, water, pad or none");
  }
}

function parseProcedural(p: Parser, v: unknown): ProceduralSettings | undefined {
  const o = p.obj(v, "procedural");
  if (!o) return undefined;
  const seed = p.int(o.seed, "procedural.seed", 0, 0xffffffff);
  const roughness = p.num(o.roughness, "procedural.roughness", 0, 1);
  const elevationRange = p.num(o.elevationRange, "procedural.elevationRange", 0, 100);
  const corridorFlatten = p.num(o.corridorFlatten, "procedural.corridorFlatten", 0, 1);
  const slope = o.slope === undefined ? undefined : p.vec2(o.slope, "procedural.slope", -0.2, 0.2);
  if (
    seed === undefined || roughness === undefined || elevationRange === undefined ||
    corridorFlatten === undefined || (o.slope !== undefined && !slope)
  ) {
    return undefined;
  }
  const out: ProceduralSettings = { seed, roughness, elevationRange, corridorFlatten };
  if (slope) out.slope = slope;
  return out;
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function parseGrid(p: Parser, v: unknown, path: string): SparseGrid | undefined {
  const o = p.obj(v, path);
  if (!o) return undefined;
  const cellSize = p.num(o.cellSize, `${path}.cellSize`, 0.05, 10);
  const chunkSize = p.int(o.chunkSize, `${path}.chunkSize`, 1, LIMITS.maxChunkSize);
  const chunks = mapArr(p, o.chunks, `${path}.chunks`, 0, LIMITS.maxGridChunks, (item, ip) => {
    const c = p.obj(item, ip);
    if (!c) return undefined;
    const cx = p.int(c.cx, `${ip}.cx`, 0, 100000);
    const cz = p.int(c.cz, `${ip}.cz`, 0, 100000);
    const data = p.str(c.data, `${ip}.data`, 4 * LIMITS.maxChunkSize * LIMITS.maxChunkSize, true);
    if (data !== undefined && !BASE64.test(data)) return p.error(`${ip}.data`, "must be base64");
    return cx === undefined || cz === undefined || data === undefined ? undefined : { cx, cz, data };
  });
  if (cellSize === undefined || chunkSize === undefined || !chunks) return undefined;
  return { cellSize, chunkSize, chunks };
}

function parseOverrides(p: Parser, v: unknown): Hole["overrides"] | undefined {
  const o = p.obj(v, "overrides");
  if (!o) return undefined;
  const out: Hole["overrides"] = {};
  if (o.height !== undefined) {
    const g = parseGrid(p, o.height, "overrides.height");
    if (!g) return undefined;
    out.height = g;
  }
  if (o.surface !== undefined) {
    const g = parseGrid(p, o.surface, "overrides.surface");
    if (!g) return undefined;
    out.surface = g;
  }
  return out;
}

function checkUniqueIds(p: Parser, hole: Hole): void {
  const seen = new Set<string>();
  const check = (id: string, path: string) => {
    if (seen.has(id)) p.error(path, `duplicate id "${id}"`);
    seen.add(id);
  };
  hole.tees.forEach((t, i) => check(t.id, `tees[${i}].id`));
  hole.pins.forEach((pin, i) => check(pin.id, `pins[${i}].id`));
  hole.shapes.forEach((s, i) => check(s.id, `shapes[${i}].id`));
}

function checkDesign(p: Parser, hole: Hole): void {
  const greens = hole.shapes.filter((s) => s.surface === "green");
  if (greens.length === 0) p.warn("shapes", "hole has no green");
  hole.pins.forEach((pin, i) => {
    if (!greens.some((g) => pointInPolygon(pin.position, g.outline))) {
      p.warn(`pins[${i}].position`, "pin is not on a green");
    }
  });

  const suggested = suggestPar(holeLength(hole));
  if (suggested !== hole.meta.par) {
    p.warn("meta.par", `par ${hole.meta.par} set, but ${Math.round(holeLength(hole))} m suggests par ${suggested}`);
  }
}
