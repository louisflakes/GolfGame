// Phase 0 placeholder: a flat, top-down Three.js view of a hole's intent layer.
// Phase 1 replaces this with real generated terrain.

import * as THREE from "three";
import type { Hole, SurfaceId, Vec2 } from "../core/types";
import { holeToWorld } from "./coords";

export const SURFACE_COLORS: Record<SurfaceId, number> = {
  rough: 0x4f7f3a,
  fairway: 0x6fae4b,
  fringe: 0x7cbf58,
  green: 0x8fd468,
  tee: 0x7ab955,
  sand: 0xe6d49a,
  water: 0x3d7fb8,
};

const TEE_MARKER_COLORS: Record<string, number> = { black: 0x111111, blue: 0x2850c8, white: 0xffffff, red: 0xd8322a, gold: 0xd4a72c };

export class FlatHoleView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private group = new THREE.Group();
  private hole?: Hole;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.scene.add(this.group);
    // Looking straight down with screen-up = toward the green (world -z), so screen-right = +x.
    this.camera.up.set(0, 0, -1);
    new ResizeObserver(() => this.resize()).observe(container);
  }

  setHole(hole: Hole): void {
    this.hole = hole;
    disposeChildren(this.group);
    const { width, length } = hole.bounds;
    this.scene.background = new THREE.Color(0x2d4a26);

    let layer = 0;
    const y = () => (layer += 0.01);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, length), basic(SURFACE_COLORS.rough));
    ground.rotation.x = -Math.PI / 2;
    holeToWorld([width / 2, length / 2], 0, ground.position);
    this.group.add(ground);

    this.group.add(routeMesh(hole.route.points.map((p) => p.position), hole.route.points.map((p) => p.width), y()));
    for (const shape of hole.shapes) {
      this.group.add(shapeMesh(shape.outline, SURFACE_COLORS[shape.surface], y()));
    }
    const markerY = y() + 0.1;
    for (const tee of hole.tees) {
      const marker = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), basic(TEE_MARKER_COLORS[tee.name] ?? 0xffffff));
      marker.rotation.x = -Math.PI / 2;
      holeToWorld(tee.position, markerY, marker.position);
      this.group.add(marker);
    }
    for (const pin of hole.pins) {
      const active = pin.id === hole.activePinId;
      const flag = new THREE.Mesh(new THREE.CircleGeometry(active ? 1.6 : 1, 16), basic(active ? 0xe8302a : 0xffffff));
      flag.rotation.x = -Math.PI / 2;
      holeToWorld(pin.position, markerY, flag.position);
      this.group.add(flag);
    }
    this.resize();
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    if (this.hole) {
      // Top-down with the tee at the bottom of the screen.
      const { width, length } = this.hole.bounds;
      const margin = 1.08;
      const scale = Math.max((width * margin) / w, (length * margin) / h);
      this.camera.left = (-w / 2) * scale;
      this.camera.right = (w / 2) * scale;
      this.camera.top = (h / 2) * scale;
      this.camera.bottom = (-h / 2) * scale;
      this.camera.near = 0.1;
      this.camera.far = 1000;
      holeToWorld([width / 2, length / 2], 500, this.camera.position);
      this.camera.lookAt(holeToWorld([width / 2, length / 2]));
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }
}

function basic(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

function smoothClosed(points: Vec2[], samples = 64): THREE.Vector2[] {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
  return curve.getSpacedPoints(samples).slice(0, -1).map((v) => new THREE.Vector2(v.x, v.z));
}

function shapeMesh(outline: Vec2[], color: number, y: number): THREE.Mesh {
  // Shape is built in X/Y from hole (x, z); rotating -90° around X maps local (x, y) to world (x, 0, -y),
  // which is exactly holeToWorld.
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(smoothClosed(outline)));
  const mesh = new THREE.Mesh(geometry, basic(color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.material.side = THREE.DoubleSide;
  return mesh;
}

function routeMesh(points: Vec2[], widths: number[], y: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const n = 120;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const f = t * (widths.length - 1);
    const k = Math.min(Math.floor(f), widths.length - 2);
    const half = (widths[k]! + (widths[k + 1]! - widths[k]!) * (f - k)) / 2;
    // Curve is in hole coordinates (x, 0, z); convert to world when writing positions.
    const nx = -tangent.z * half;
    const nz = tangent.x * half;
    positions.push(p.x + nx, y, -(p.z + nz), p.x - nx, y, -(p.z - nz));
    if (i < n) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const material = basic(SURFACE_COLORS.fairway);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}

function disposeChildren(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  }
}
