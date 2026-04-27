/**
 * CubeMesh — generates a 3×3×3 Rubik's Cube Three.js group.
 * 26 visible cubies, each with 6 face materials (colored stickers + dark body).
 * Standard solved-state face colors from SPEC §5.1.
 */
import * as THREE from 'three';

/** Hex colors matching CSS custom properties in tokens.css. */
const COLOR = {
  WHITE: 0xffffff,
  YELLOW: 0xffd500,
  RED: 0xc41e3a,
  ORANGE: 0xff5800,
  BLUE: 0x0051ba,
  GREEN: 0x009e60,
  BODY: 0x1a1a1a,
};

/**
 * Face color for each axis direction in the solved state.
 * Index mapping matches BoxGeometry material order:
 *   0 = +X, 1 = -X, 2 = +Y, 3 = -Y, 4 = +Z, 5 = -Z
 *
 * Solved-state face assignments:
 *   +X (right)  = Red
 *   -X (left)   = Orange
 *   +Y (top)    = White
 *   -Y (bottom) = Yellow
 *   +Z (front)  = Green
 *   -Z (back)   = Blue
 */
const FACE_COLORS = [
  COLOR.RED,    // +X
  COLOR.ORANGE, // -X
  COLOR.WHITE,  // +Y
  COLOR.YELLOW, // -Y
  COLOR.GREEN,  // +Z
  COLOR.BLUE,   // -Z
];

/**
 * Which axis index each BoxGeometry face corresponds to and its sign.
 * Used to determine if a cubie face is an outer (sticker) face.
 * [axisIndex, sign]: axisIndex 0=x, 1=y, 2=z; sign +1 or -1
 */
const FACE_AXIS = [
  [0, 1],  // +X
  [0, -1], // -X
  [1, 1],  // +Y
  [1, -1], // -Y
  [2, 1],  // +Z
  [2, -1], // -Z
];

/** Cubie size with small gap for premium look. */
const CUBIE_SIZE = 0.92;
const SPACING = 1.0;

/**
 * Creates a MeshStandardMaterial for a sticker face.
 * @param {number} color
 * @returns {THREE.MeshStandardMaterial}
 */
function stickerMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.1,
  });
}

/**
 * Creates a MeshStandardMaterial for the cubie body (non-sticker faces).
 * @returns {THREE.MeshStandardMaterial}
 */
function bodyMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLOR.BODY,
    roughness: 0.8,
    metalness: 0.0,
  });
}

/**
 * Builds the 6-material array for one cubie at grid position (cx, cy, cz).
 * Each element corresponds to a BoxGeometry face.
 * Outer faces get their sticker color; inner faces get the body color.
 *
 * @param {number} cx - Cubie column: -1, 0, or +1
 * @param {number} cy - Cubie row: -1, 0, or +1
 * @param {number} cz - Cubie depth: -1, 0, or +1
 * @returns {THREE.MeshStandardMaterial[]}
 */
function buildMaterials(cx, cy, cz) {
  const pos = [cx, cy, cz];
  return FACE_AXIS.map(([axisIdx, sign], faceIdx) => {
    const isOuter = pos[axisIdx] === sign;
    return isOuter ? stickerMaterial(FACE_COLORS[faceIdx]) : bodyMaterial();
  });
}

/**
 * Generates the full 3×3×3 cube as a THREE.Group.
 * Skips the internal center piece at (0,0,0).
 *
 * @returns {THREE.Group}
 */
export function createCubeMesh() {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) { continue; }

        const materials = buildMaterials(x, y, z);
        const cubie = new THREE.Mesh(geometry, materials);
        cubie.position.set(x * SPACING, y * SPACING, z * SPACING);
        cubie.castShadow = true;
        cubie.receiveShadow = false;
        group.add(cubie);
      }
    }
  }

  return group;
}
