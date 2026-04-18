const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];
const groupStorage = window.DiceForgeGroupStorage;
const DIE_COLORS = {
  4: "#ff8a5b",
  6: "#ffc14d",
  8: "#67d6b5",
  10: "#62b6ff",
  12: "#9d8cff",
  20: "#ff6fae",
  100: "#c3d5ff",
};

const starterGroups = [
  {
    id: crypto.randomUUID(),
    name: "Greatsword",
    shortName: "GSW",
    color: "#d95f43",
    equation: "2d6+4",
    damageType: "slashing",
    selected: true,
    collapsed: true,
  },
  {
    id: crypto.randomUUID(),
    name: "Sneak Attack",
    shortName: "SNK",
    color: "#4aa885",
    equation: "3d6",
    damageType: "piercing",
    selected: true,
    collapsed: true,
  },
  {
    id: crypto.randomUUID(),
    name: "Fire Bolt",
    shortName: "FBT",
    color: "#4a84d9",
    equation: "2d10+2",
    damageType: "fire",
    selected: false,
    collapsed: true,
  },
];

const STORAGE_KEYS = {
  groups: "dice-forge-groups-v1",
  savedSets: "dice-forge-saved-sets-v1",
};
const ROLL_MODES = ["normal", "crit", "adv", "disadv"];
const ROLL_MODE_LABELS = {
  normal: "Normal",
  crit: "Crit",
  adv: "Adv",
  disadv: "Disadv",
};

const state = {
  groups: loadGroups(),
  history: [],
  lastResult: null,
  savedSets: loadSavedSets(),
  drawerOpen: false,
  draggingGroupId: null,
  historyOpen: false,
  rollAnimating: false,
  rollMode: "normal",
};

const groupTemplate = document.querySelector("#group-template");
const historyTemplate = document.querySelector("#history-entry-template");
const groupsContainer = document.querySelector("#groups-container");
const historyContainer = document.querySelector("#history-container");
const historySheet = document.querySelector("#history-sheet");
const addGroupButton = document.querySelector("#add-group-button");
const rollModeButton = document.querySelector("#roll-mode-button");
const rollModeLabel = document.querySelector("#roll-mode-label");
const clearHistoryButton = document.querySelector("#clear-history-button");
const openSavedSetsButton = document.querySelector("#open-saved-sets-button");
const closeSavedSetsButton = document.querySelector("#close-saved-sets-button");
const drawerBackdrop = document.querySelector("#drawer-backdrop");
const savedSetsDrawer = document.querySelector("#saved-sets-drawer");
const savedSetNameInput = document.querySelector("#saved-set-name");
const saveCurrentSetButton = document.querySelector("#save-current-set-button");
const savedSetsList = document.querySelector("#saved-sets-list");
const exportGroupsButton = document.querySelector("#export-groups-button");
const importGroupsInput = document.querySelector("#import-groups-input");
const toggleHistoryButton = document.querySelector("#toggle-history-button");
const diceStagePanel = document.querySelector(".dice-stage");
const diceCanvas = document.querySelector("#dice-canvas");
const diceStageStatus = document.querySelector("#dice-stage-status");
const diceStageTotal = document.querySelector("#dice-stage-total");
const diceStageDetail = document.querySelector("#dice-stage-detail");
const diceStageBreakdown = document.querySelector("#dice-stage-breakdown");
let rollModePointerStartY = null;
let rollModePointerMoved = false;
let historyPointerStartY = null;

const STAGE_FACE_COLORS = {
  4: "#7f77dd",
  6: "#1d9e75",
  8: "#d85a30",
  10: "#378add",
  12: "#d4537e",
  20: "#ba7517",
  100: "#7688b8",
};
const STAGE_EDGE_COLORS = {
  4: "#3c3489",
  6: "#085041",
  8: "#712b13",
  10: "#0c447c",
  12: "#72243e",
  20: "#633806",
  100: "#4c5679",
};
const STAGE_CANVAS_WIDTH = 640;
const STAGE_CANVAS_HEIGHT = 360;
const STAGE_RADIUS = 1.15;
const STAGE_FLOOR = 0;
const STAGE_GRAVITY = -80;
const STAGE_BOUNCE_FLOOR = 0.45;
const STAGE_BOUNCE_WALL = 0.72;
const STAGE_BOUNCE_DICE = 0.68;
const STAGE_SETTLE_VELOCITY = 0.9;
const STAGE_MAX_BOUNCES = 7;
const STAGE_CAMERA_HALF_X = 8;
const STAGE_CAMERA_HALF_Z = STAGE_CAMERA_HALF_X * (STAGE_CANVAS_HEIGHT / STAGE_CANVAS_WIDTH);
const STAGE_BOUND_X = STAGE_CAMERA_HALF_X - STAGE_RADIUS - 0.05;
const STAGE_BOUND_Z = STAGE_CAMERA_HALF_Z - STAGE_RADIUS - 0.05;
const STAGE_GROUP_PALETTE = [
  { face: "#d95f43", edge: "#7f2618" },
  { face: "#d9a441", edge: "#7c560f" },
  { face: "#4aa885", edge: "#1a5a45" },
  { face: "#4a84d9", edge: "#173f7a" },
  { face: "#8a63d9", edge: "#44247e" },
  { face: "#d05ca9", edge: "#7a275f" },
  { face: "#57a7be", edge: "#225765" },
  { face: "#9cab52", edge: "#505d1e" },
];

const diceStage = {
  ready: false,
  available: Boolean(window.THREE && diceCanvas),
  renderer: null,
  scene: null,
  camera: null,
  ambient: null,
  keyLight: null,
  fillLight: null,
  tableMesh: null,
  dice: [],
  frameId: null,
  lastTs: 0,
  rolling: false,
  resolveRoll: null,
};

function requestDiceStageFrame() {
  if (!diceStage.ready || diceStage.frameId) {
    return;
  }
  diceStage.frameId = window.requestAnimationFrame(stepDiceStage);
}

function stopDiceStageFrame() {
  if (!diceStage.frameId) {
    return;
  }
  window.cancelAnimationFrame(diceStage.frameId);
  diceStage.frameId = null;
}

function initializeDiceStage() {
  if (!diceStage.available) {
    if (diceCanvas) {
      diceCanvas.classList.add("dice-stage__canvas--fallback");
    }
    return;
  }

  const { THREE } = window;
  const renderer = new THREE.WebGLRenderer({
    canvas: diceCanvas,
    antialias: true,
    alpha: false,
  });
  renderer.setClearColor(0x1c1a17, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -STAGE_CAMERA_HALF_X,
    STAGE_CAMERA_HALF_X,
    STAGE_CAMERA_HALF_Z,
    -STAGE_CAMERA_HALF_Z,
    0.1,
    200
  );
  camera.position.set(0, 30, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, -1);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(2, 20, 4);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
  fillLight.position.set(-4, 8, -6);

  scene.add(ambient);
  scene.add(keyLight);
  scene.add(fillLight);

  const tableMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshPhongMaterial({ color: 0x2e2920, shininess: 4 })
  );
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = STAGE_FLOOR - 0.01;
  scene.add(tableMesh);

  for (let i = -8; i <= 8; i += 1) {
    let geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(i, -0.005, -8),
      new THREE.Vector3(i, -0.005, 8),
    ]);
    scene.add(
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x3a3528, transparent: true, opacity: 0.4 })
      )
    );

    geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-8, -0.005, i),
      new THREE.Vector3(8, -0.005, i),
    ]);
    scene.add(
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x3a3528, transparent: true, opacity: 0.4 })
      )
    );
  }

  const wallPoints = [
    new THREE.Vector3(-STAGE_BOUND_X, -0.002, -STAGE_BOUND_Z),
    new THREE.Vector3(STAGE_BOUND_X, -0.002, -STAGE_BOUND_Z),
    new THREE.Vector3(STAGE_BOUND_X, -0.002, STAGE_BOUND_Z),
    new THREE.Vector3(-STAGE_BOUND_X, -0.002, STAGE_BOUND_Z),
    new THREE.Vector3(-STAGE_BOUND_X, -0.002, -STAGE_BOUND_Z),
  ];
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(wallPoints),
      new THREE.LineBasicMaterial({ color: 0x7a6a50 })
    )
  );

  diceStage.renderer = renderer;
  diceStage.scene = scene;
  diceStage.camera = camera;
  diceStage.ambient = ambient;
  diceStage.keyLight = keyLight;
  diceStage.fillLight = fillLight;
  diceStage.tableMesh = tableMesh;
  diceStage.ready = true;

  resizeDiceStage();
  window.addEventListener("resize", resizeDiceStage);
  diceStage.renderer.render(diceStage.scene, diceStage.camera);
}

function resizeDiceStage() {
  if (!diceStage.ready) {
    return;
  }

  const width = Math.max(320, Math.round(diceCanvas.clientWidth || STAGE_CANVAS_WIDTH));
  const height = Math.max(220, Math.round(diceCanvas.clientHeight || STAGE_CANVAS_HEIGHT));
  diceStage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  diceStage.renderer.setSize(width, height, false);
  const halfX = STAGE_CAMERA_HALF_X;
  const halfZ = halfX * (height / width);
  diceStage.camera.left = -halfX;
  diceStage.camera.right = halfX;
  diceStage.camera.top = halfZ;
  diceStage.camera.bottom = -halfZ;
  diceStage.camera.updateProjectionMatrix();
}

function makeStageFaceTexture(label, bgColor) {
  const { THREE } = window;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.fillStyle = bgColor;
  context.fillRect(0, 0, size, size);
  context.fillStyle = "rgba(255,255,255,0.1)";
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = `bold ${String(label).length > 2 ? 82 : 104}px Arial,sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(label), size / 2, size / 2 + 5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function shiftHexColor(color, amount) {
  const normalized = color.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized
        .split("")
        .map((channel) => channel + channel)
        .join("")
    : normalized;
  const red = clampColorChannel(parseInt(expanded.slice(0, 2), 16) + amount);
  const green = clampColorChannel(parseInt(expanded.slice(2, 4), 16) + amount);
  const blue = clampColorChannel(parseInt(expanded.slice(4, 6), 16) + amount);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function getStageGroupColors(groupResult, groupIndex) {
  if (groupResult.color) {
    return {
      face: groupResult.color,
      edge: shiftHexColor(groupResult.color, -42),
    };
  }
  const paletteEntry = STAGE_GROUP_PALETTE[groupIndex % STAGE_GROUP_PALETTE.length];
  const hashSeed = `${groupResult.groupId}:${groupResult.name}:${groupResult.damageType}`;
  const hash = Array.from(hashSeed).reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
  const shift = (hash % 25) - 12;
  return {
    face: shiftHexColor(paletteEntry.face, shift),
    edge: shiftHexColor(paletteEntry.edge, Math.round(shift * 0.5)),
  };
}

function buildStagePolyGeometry(facePolygons) {
  const { THREE } = window;
  const positions = [];
  const uvs = [];
  const groups = [];

  facePolygons.forEach((polygon, faceIndex) => {
    const vertexCount = polygon.length;
    const center = polygon.reduce(
      (accumulator, vertex) => [
        accumulator[0] + vertex[0] / vertexCount,
        accumulator[1] + vertex[1] / vertexCount,
        accumulator[2] + vertex[2] / vertexCount,
      ],
      [0, 0, 0]
    );

    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let index = 0; index < vertexCount; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % vertexCount];
      nx += (current[1] - next[1]) * (current[2] + next[2]);
      ny += (current[2] - next[2]) * (current[0] + next[0]);
      nz += (current[0] - next[0]) * (current[1] + next[1]);
    }

    const normalLength = Math.hypot(nx, ny, nz) || 1;
    nx /= normalLength;
    ny /= normalLength;
    nz /= normalLength;

    let tx = 1;
    let ty = 0;
    let tz = 0;
    if (Math.abs(nx) > 0.8) {
      tx = 0;
      ty = 1;
      tz = 0;
    }
    const tangentDot = tx * nx + ty * ny + tz * nz;
    tx -= tangentDot * nx;
    ty -= tangentDot * ny;
    tz -= tangentDot * nz;
    const tangentLength = Math.hypot(tx, ty, tz) || 1;
    tx /= tangentLength;
    ty /= tangentLength;
    tz /= tangentLength;

    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;

    const projected = polygon.map((vertex) => {
      const dx = vertex[0] - center[0];
      const dy = vertex[1] - center[1];
      const dz = vertex[2] - center[2];
      return [dx * tx + dy * ty + dz * tz, dx * bx + dy * by + dz * bz];
    });
    const uValues = projected.map((value) => value[0]);
    const vValues = projected.map((value) => value[1]);
    const uMin = Math.min(...uValues);
    const uMax = Math.max(...uValues) || 1;
    const vMin = Math.min(...vValues);
    const vMax = Math.max(...vValues) || 1;
    const pad = 0.07;
    const faceUvs = projected.map(([u, v]) => [
      pad + ((u - uMin) / (uMax - uMin || 1)) * (1 - 2 * pad),
      pad + ((v - vMin) / (vMax - vMin || 1)) * (1 - 2 * pad),
    ]);

    const triangleStart = positions.length / 3;
    for (let index = 1; index < vertexCount - 1; index += 1) {
      [0, index, index + 1].forEach((vertexIndex) => {
        const vertex = polygon[vertexIndex];
        positions.push(vertex[0], vertex[1], vertex[2]);
        uvs.push(faceUvs[vertexIndex][0], faceUvs[vertexIndex][1]);
      });
    }
    groups.push([triangleStart, positions.length / 3 - triangleStart, faceIndex]);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  groups.forEach(([start, count, materialIndex]) => geometry.addGroup(start, count, materialIndex));
  return geometry;
}

function buildStageD4() {
  const scale = (STAGE_RADIUS / Math.sqrt(3)) * 1.05;
  const vertices = [
    [scale, scale, scale],
    [scale, -scale, -scale],
    [-scale, scale, -scale],
    [-scale, -scale, scale],
  ];
  return buildStagePolyGeometry([
    [vertices[0], vertices[2], vertices[1]],
    [vertices[0], vertices[1], vertices[3]],
    [vertices[0], vertices[3], vertices[2]],
    [vertices[1], vertices[2], vertices[3]],
  ]);
}

function buildStageD8() {
  const radius = STAGE_RADIUS;
  const vertices = [
    [0, radius, 0],
    [radius, 0, 0],
    [0, 0, radius],
    [-radius, 0, 0],
    [0, 0, -radius],
    [0, -radius, 0],
  ];
  return buildStagePolyGeometry([
    [vertices[0], vertices[2], vertices[1]],
    [vertices[0], vertices[3], vertices[2]],
    [vertices[0], vertices[4], vertices[3]],
    [vertices[0], vertices[1], vertices[4]],
    [vertices[5], vertices[1], vertices[2]],
    [vertices[5], vertices[2], vertices[3]],
    [vertices[5], vertices[3], vertices[4]],
    [vertices[5], vertices[4], vertices[1]],
  ]);
}

function buildStageD10() {
  const radius = STAGE_RADIUS * 0.9;
  const ringHeight = radius * 0.1;
  const upper = [];
  const lower = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = (index * Math.PI * 2) / 5;
    upper.push([radius * Math.cos(angle), ringHeight, radius * Math.sin(angle)]);
  }
  for (let index = 0; index < 5; index += 1) {
    const angle = (index * Math.PI * 2) / 5 + Math.PI / 5;
    lower.push([radius * Math.cos(angle), -ringHeight, radius * Math.sin(angle)]);
  }

  const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const normal = cross(subtract(lower[0], upper[0]), subtract(upper[1], upper[0]));
  const apexHeight = upper[0][1] + (normal[0] * upper[0][0] + normal[2] * upper[0][2]) / normal[1];
  const top = [0, apexHeight, 0];
  const bottom = [0, -apexHeight, 0];
  const faces = [];
  for (let index = 0; index < 5; index += 1) {
    faces.push([top, upper[(index + 1) % 5], lower[index], upper[index]]);
  }
  for (let index = 0; index < 5; index += 1) {
    faces.push([bottom, lower[index], upper[(index + 1) % 5], lower[(index + 1) % 5]]);
  }
  return buildStagePolyGeometry(faces);
}

function buildStageD12() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const a = STAGE_RADIUS / Math.sqrt(3);
  const b = a / phi;
  const c = a * phi;
  const vertices = [
    [a, a, a], [a, a, -a], [a, -a, a], [a, -a, -a],
    [-a, a, a], [-a, a, -a], [-a, -a, a], [-a, -a, -a],
    [0, b, c], [0, b, -c], [0, -b, c], [0, -b, -c],
    [b, c, 0], [b, -c, 0], [-b, c, 0], [-b, -c, 0],
    [c, 0, b], [c, 0, -b], [-c, 0, b], [-c, 0, -b],
  ];
  const faces = [
    [0, 8, 10, 2, 16], [0, 16, 17, 1, 12], [0, 12, 14, 4, 8],
    [4, 14, 5, 19, 18], [4, 18, 6, 10, 8], [6, 18, 19, 7, 15],
    [7, 19, 5, 9, 11], [7, 11, 3, 13, 15], [3, 11, 9, 1, 17],
    [3, 17, 16, 2, 13], [2, 10, 6, 15, 13], [1, 9, 5, 14, 12],
  ];
  return buildStagePolyGeometry(faces.map((face) => face.map((index) => vertices[index])));
}

function buildStageD20() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const scale = STAGE_RADIUS / Math.sqrt(1 + phi * phi);
  const tall = scale * phi;
  const vertices = [
    [-scale, tall, 0], [scale, tall, 0], [-scale, -tall, 0], [scale, -tall, 0],
    [0, -scale, tall], [0, scale, tall], [0, -scale, -tall], [0, scale, -tall],
    [tall, 0, -scale], [tall, 0, scale], [-tall, 0, -scale], [-tall, 0, scale],
  ];
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const polygons = faces.map((face) => {
    const points = face.map((index) => vertices[index]);
    const normal = cross(subtract(points[1], points[0]), subtract(points[2], points[0]));
    const center = [
      (points[0][0] + points[1][0] + points[2][0]) / 3,
      (points[0][1] + points[1][1] + points[2][1]) / 3,
      (points[0][2] + points[1][2] + points[2][2]) / 3,
    ];
    return dot(normal, center) < 0 ? [points[0], points[2], points[1]] : points;
  });
  return buildStagePolyGeometry(polygons);
}

function buildDieGeometry(sides) {
  const { THREE } = window;
  if (sides === 4) return buildStageD4();
  if (sides === 6) return new THREE.BoxGeometry(STAGE_RADIUS * 1.42, STAGE_RADIUS * 1.42, STAGE_RADIUS * 1.42);
  if (sides === 8) return buildStageD8();
  if (sides === 10 || sides === 100) return buildStageD10();
  if (sides === 12) return buildStageD12();
  return buildStageD20();
}

function precomputeFaceOrientations(mesh, sides) {
  const { THREE } = window;
  const geometry = mesh.geometry;
  const positions = geometry.attributes.position;
  const up = new THREE.Vector3(0, 1, 0);
  const faces = [];

  if (sides === 6) {
    [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ].forEach((localNormal, index) => {
      faces.push({
        label: index + 1,
        localNormal: localNormal.clone(),
        q: new THREE.Quaternion().setFromUnitVectors(localNormal, up),
      });
    });
    return faces;
  }

  geometry.groups.forEach((group, groupIndex) => {
    const label = groupIndex % sides === 0 && sides === 100 ? 100 : (groupIndex % sides) + 1;
    const normal = new THREE.Vector3();
    const triangleCount = group.count / 3;
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const base = group.start + triangle * 3;
      const a = new THREE.Vector3().fromBufferAttribute(positions, base);
      const b = new THREE.Vector3().fromBufferAttribute(positions, base + 1);
      const c = new THREE.Vector3().fromBufferAttribute(positions, base + 2);
      normal.add(new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize());
    }
    if (normal.length() < 0.001) return;
    normal.normalize();
    faces.push({
      label,
      localNormal: normal.clone(),
      q: new THREE.Quaternion().setFromUnitVectors(normal, up),
    });
  });

  return faces;
}

function buildDieMesh(sides, colors = {}) {
  const { THREE } = window;
  const faceColor = colors.face ?? STAGE_FACE_COLORS[sides] ?? "#c3d5ff";
  const edgeColor = colors.edge ?? STAGE_EDGE_COLORS[sides] ?? "#f4ead7";
  const geometry = buildDieGeometry(sides);
  let mesh;

  if (sides === 6) {
    const materials = Array.from({ length: 6 }, (_, index) => new THREE.MeshLambertMaterial({
      map: makeStageFaceTexture(index + 1, faceColor),
    }));
    mesh = new THREE.Mesh(geometry, materials);
  } else {
    const materials = Array.from({ length: geometry.groups.length }, (_, index) => new THREE.MeshLambertMaterial({
      map: makeStageFaceTexture((index % sides) + 1, faceColor),
    }));
    mesh = new THREE.Mesh(geometry, materials);
  }

  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 15),
    new THREE.LineBasicMaterial({ color: edgeColor })
  ));
  return mesh;
}

function createDieEntity(sides, value, colors) {
  const mesh = buildDieMesh(sides, colors);
  mesh.position.set(0, STAGE_FLOOR + STAGE_RADIUS, 0);
  mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  return {
    mesh,
    sides,
    result: value,
    vy: 0,
    vX: 0,
    vZ: 0,
    vRx: 0,
    vRy: 0,
    vRz: 0,
    settled: true,
    stillFrames: 0,
    delay: 0,
    age: 0,
    snapping: false,
    snapQ: null,
    faceOrientations: precomputeFaceOrientations(mesh, sides),
  };
}

function clearStageDice() {
  if (!diceStage.ready) {
    return;
  }

  diceStage.dice.forEach((die) => {
    diceStage.scene.remove(die.mesh);
    const materials = Array.isArray(die.mesh.material) ? die.mesh.material : [die.mesh.material];
    materials.forEach((material) => {
      if (material.map) material.map.dispose();
      material.dispose();
    });
    die.mesh.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    die.mesh.geometry.dispose();
  });

  diceStage.dice = [];
}

function createStageDice(result) {
  clearStageDice();

  const diceValues = [];
  result.groupResults.forEach((groupResult, groupIndex) => {
    const colors = getStageGroupColors(groupResult, groupIndex);
    groupResult.diceEntries.forEach((entry) => {
      entry.values.forEach((value) => {
        diceValues.push({ sides: entry.sides, value, colors });
      });
    });
  });

  if (diceValues.length === 0) {
    renderDiceStageSummary(result);
    return [];
  }

  diceStage.dice = diceValues.map((item) => {
    const die = createDieEntity(item.sides, item.value, item.colors);
    diceStage.scene.add(die.mesh);
    return die;
  });

  return diceStage.dice;
}

function startStageRoll(result) {
  if (!diceStage.ready) {
    renderDiceStageSummary(result);
    return Promise.resolve();
  }

  const dice = createStageDice(result);
  renderDiceStageSummary(result);

  if (dice.length === 0) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 420);
    });
  }

  diceStage.rolling = true;
  const wall = Math.floor(Math.random() * 4);

  dice.forEach((die, index) => {
    die.settled = false;
    die.stillFrames = 0;
    die.snapping = false;
    die.snapQ = null;
    die.age = 0;
    let startX;
    let startZ;
    let startVX;
    let startVZ;
    const spread = (Math.random() - 0.5) * (wall < 2 ? STAGE_BOUND_Z * 1.2 : STAGE_BOUND_X * 1.2);
    const throwSpeed = 32 + Math.random() * 12;
    const sideAngle = (Math.random() - 0.5) * 0.55;

    if (wall === 0) {
      startX = -(STAGE_BOUND_X + STAGE_RADIUS);
      startZ = spread;
      startVX = throwSpeed;
      startVZ = sideAngle * throwSpeed;
    } else if (wall === 1) {
      startX = STAGE_BOUND_X + STAGE_RADIUS;
      startZ = spread;
      startVX = -throwSpeed;
      startVZ = sideAngle * throwSpeed;
    } else if (wall === 2) {
      startX = spread;
      startZ = -(STAGE_BOUND_Z + STAGE_RADIUS);
      startVZ = throwSpeed;
      startVX = sideAngle * throwSpeed;
    } else {
      startX = spread;
      startZ = STAGE_BOUND_Z + STAGE_RADIUS;
      startVZ = -throwSpeed;
      startVX = sideAngle * throwSpeed;
    }

    die.mesh.position.set(startX, STAGE_FLOOR + STAGE_RADIUS + 1.8 + Math.random() * 1.5, startZ);
    die.mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    const spin = 28 + Math.random() * 20;
    const angle = Math.random() * Math.PI * 2;
    die.vX = startVX + (Math.random() - 0.5) * 5;
    die.vZ = startVZ + (Math.random() - 0.5) * 5;
    die.vy = -4 - Math.random() * 4;
    die.vRx = Math.cos(angle) * spin * (Math.random() > 0.5 ? 1 : -1);
    die.vRy = (Math.random() - 0.5) * spin * 2.5;
    die.vRz = Math.sin(angle) * spin * (Math.random() > 0.5 ? 1 : -1);
    die.delay = index * 0.07 + Math.random() * 0.05;
  });

  if (diceStage.resolveRoll) {
    diceStage.resolveRoll();
  }

  const rollPromise = new Promise((resolve) => {
    diceStage.resolveRoll = resolve;
  });
  requestDiceStageFrame();
  return rollPromise;
}

function updateStageDie(die, deltaSeconds) {
  die.age += deltaSeconds;
  const floorY = STAGE_FLOOR + STAGE_RADIUS;

  if (die.settled) {
    return true;
  }

  if (die.age < die.delay) {
    return false;
  }

  if (die.snapping) {
    die.mesh.quaternion.slerp(die.snapQ, 0.22);
    if (die.mesh.quaternion.angleTo(die.snapQ) < 0.005) {
      die.mesh.quaternion.copy(die.snapQ);
      die.vy = 0;
      die.vX = 0;
      die.vZ = 0;
      die.vRx = 0;
      die.vRy = 0;
      die.vRz = 0;
      die.mesh.position.y = floorY;
      die.settled = true;
      return true;
    }
    return false;
  }

  die.vy += STAGE_GRAVITY * deltaSeconds;
  die.mesh.position.y += die.vy * deltaSeconds;
  die.vX *= 0.997;
  die.vZ *= 0.997;
  die.mesh.position.x += die.vX * deltaSeconds;
  die.mesh.position.z += die.vZ * deltaSeconds;

  if (die.mesh.position.x > STAGE_BOUND_X) {
    die.mesh.position.x = STAGE_BOUND_X;
    die.vX = -Math.abs(die.vX) * STAGE_BOUNCE_WALL;
    die.vRy += (Math.random() - 0.5) * 6;
  }
  if (die.mesh.position.x < -STAGE_BOUND_X) {
    die.mesh.position.x = -STAGE_BOUND_X;
    die.vX = Math.abs(die.vX) * STAGE_BOUNCE_WALL;
    die.vRy += (Math.random() - 0.5) * 6;
  }
  if (die.mesh.position.z > STAGE_BOUND_Z) {
    die.mesh.position.z = STAGE_BOUND_Z;
    die.vZ = -Math.abs(die.vZ) * STAGE_BOUNCE_WALL;
    die.vRy += (Math.random() - 0.5) * 6;
  }
  if (die.mesh.position.z < -STAGE_BOUND_Z) {
    die.mesh.position.z = -STAGE_BOUND_Z;
    die.vZ = Math.abs(die.vZ) * STAGE_BOUNCE_WALL;
    die.vRy += (Math.random() - 0.5) * 6;
  }

  if (die.mesh.position.y <= floorY && die.vy < 0) {
    die.mesh.position.y = floorY;
    const rebound = Math.abs(die.vy) * STAGE_BOUNCE_FLOOR;
    die.vy = rebound > 0.8 ? rebound : 0;
    die.vX *= 0.6;
    die.vZ *= 0.6;
    die.vRx *= 0.42;
    die.vRy *= 0.42;
    die.vRz *= 0.42;
  }
  if (die.mesh.position.y < floorY) {
    die.mesh.position.y = floorY;
    if (die.vy < 0) die.vy = 0;
  }

  die.mesh.rotation.x += die.vRx * deltaSeconds;
  die.mesh.rotation.y += die.vRy * deltaSeconds;
  die.mesh.rotation.z += die.vRz * deltaSeconds;

  const onFloor = die.mesh.position.y <= floorY + 0.02;
  if (onFloor) {
    die.vRx *= 0.88;
    die.vRy *= 0.88;
    die.vRz *= 0.88;
    die.vX *= 0.88;
    die.vZ *= 0.88;
  }

  const totalVelocity = Math.abs(die.vy) + Math.abs(die.vX) + Math.abs(die.vZ);
  const totalSpin = Math.abs(die.vRx) + Math.abs(die.vRy) + Math.abs(die.vRz);
  if (onFloor && totalVelocity < 2.5 && totalSpin < 3.0) {
    die.stillFrames += 1;
  } else {
    die.stillFrames = 0;
  }

  if (die.stillFrames > 6 && !die.snapping) {
    die.vy = 0;
    die.vX = 0;
    die.vZ = 0;
    die.vRx = 0;
    die.vRy = 0;
    die.vRz = 0;
    die.mesh.position.y = floorY;
    const face = die.faceOrientations.find((entry) => entry.label === die.result) || die.faceOrientations[0];
    const yaw = new window.THREE.Quaternion().setFromEuler(new window.THREE.Euler(0, Math.random() * Math.PI * 2, 0));
    die.snapQ = yaw.clone().multiply(face.q);
    die.snapping = true;
  }

  return false;
}

function resolveStageDiceCollisions() {
  for (let i = 0; i < diceStage.dice.length; i += 1) {
    for (let j = i + 1; j < diceStage.dice.length; j += 1) {
      const first = diceStage.dice[i];
      const second = diceStage.dice[j];
      if ((first.settled && second.settled) || first.snapping || second.snapping) {
        continue;
      }

      const dx = second.mesh.position.x - first.mesh.position.x;
      const dy = second.mesh.position.y - first.mesh.position.y;
      const dz = second.mesh.position.z - first.mesh.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minimumDistance = STAGE_RADIUS * 2;
      if (distance >= minimumDistance || distance <= 0.001) {
        continue;
      }

      const nx = dx / distance;
      const ny = dy / distance;
      const nz = dz / distance;
      const overlap = (minimumDistance - distance) / 2;

      if (!first.settled) {
        first.mesh.position.x -= nx * overlap;
        first.mesh.position.y -= ny * overlap;
        first.mesh.position.z -= nz * overlap;
      }
      if (!second.settled) {
        second.mesh.position.x += nx * overlap;
        second.mesh.position.y += ny * overlap;
        second.mesh.position.z += nz * overlap;
      }

      const deltaVX = first.vX - second.vX;
      const deltaVY = first.vy - second.vy;
      const deltaVZ = first.vZ - second.vZ;
      const dot = deltaVX * nx + deltaVY * ny + deltaVZ * nz;
      if (dot <= 0) {
        continue;
      }

      const impulse = dot * STAGE_BOUNCE_DICE;
      if (!first.settled) {
        first.vX -= impulse * nx;
        first.vy -= impulse * ny;
        first.vZ -= impulse * nz;
        first.vRx += (Math.random() - 0.5) * impulse * 5;
        first.vRz += (Math.random() - 0.5) * impulse * 5;
      }
      if (!second.settled) {
        second.vX += impulse * nx;
        second.vy += impulse * ny;
        second.vZ += impulse * nz;
        second.vRx += (Math.random() - 0.5) * impulse * 5;
        second.vRz += (Math.random() - 0.5) * impulse * 5;
      }
    }
  }
}

function stepDiceStage(timestamp) {
  if (!diceStage.ready) {
    return;
  }

  diceStage.frameId = null;

  if (!diceStage.lastTs) {
    diceStage.lastTs = timestamp;
  }

  const deltaSeconds = Math.min((timestamp - diceStage.lastTs) / 1000, 0.032);
  diceStage.lastTs = timestamp;

  if (diceStage.rolling) {
    const settledCount = diceStage.dice.reduce(
      (count, die) => count + (updateStageDie(die, deltaSeconds) ? 1 : 0),
      0
    );
    resolveStageDiceCollisions();

    if (settledCount === diceStage.dice.length) {
      diceStage.rolling = false;
      if (diceStage.resolveRoll) {
        diceStage.resolveRoll();
        diceStage.resolveRoll = null;
      }
      diceStage.renderer.render(diceStage.scene, diceStage.camera);
      stopDiceStageFrame();
      return;
    }
  }

  diceStage.renderer.render(diceStage.scene, diceStage.camera);
  requestDiceStageFrame();
}

function renderDiceStageSummary(result) {
  if (!result) {
    diceStageStatus.textContent = "Select groups and roll.";
    diceStageTotal.textContent = "-";
    diceStageDetail.innerHTML = '<span class="dice-stage__chip">No roll yet.</span>';
    diceStageBreakdown.innerHTML = "";
    return;
  }

  diceStageStatus.textContent = `${ROLL_MODE_LABELS[result.rollMode] || "Normal"} roll`;
  diceStageTotal.textContent = result.total;
  diceStageDetail.innerHTML = result.groupResults
    .map(
      (groupResult) =>
        `<span class="dice-stage__chip"><strong>${escapeHtml(groupResult.name)}</strong> ${groupResult.total}</span>`
    )
    .join("");
  diceStageBreakdown.innerHTML = result.damageTotals
    .map(
      (damage) =>
        `<span class="dice-stage__chip">${escapeHtml(damage.type)} <strong>${damage.total}</strong></span>`
    )
    .join("");
}

function loadSavedSets() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.savedSets);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizeSavedSet(entry))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function persistSavedSets() {
  window.localStorage.setItem(STORAGE_KEYS.savedSets, JSON.stringify(state.savedSets));
}

function normalizeGroup(group, fallbackIndex = 0) {
  return groupStorage.normalizeGroup(group, fallbackIndex, {
    palette: STAGE_GROUP_PALETTE,
    createId: () => crypto.randomUUID(),
  });
}

function normalizeSavedSet(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const groups = Array.isArray(entry.groups) ? entry.groups.map(normalizeGroup).filter(Boolean) : [];
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    name:
      typeof entry.name === "string" && entry.name.trim()
        ? entry.name.trim().slice(0, 40)
        : `Set ${groups.length || 1}`,
    groups,
  };
}

function loadGroups() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.groups);
    if (!raw) {
      const defaults = structuredClone(starterGroups);
      window.localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const defaults = structuredClone(starterGroups);
      window.localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(defaults));
      return defaults;
    }
    return parsed;
  } catch {
    return structuredClone(starterGroups);
  }
}

function persistGroups() {
  try {
    window.localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(state.groups));
  } catch (error) {
    console.warn("Failed to persist groups", error);
  }
}

function syncRollModeUi() {
  rollModeLabel.textContent = ROLL_MODE_LABELS[state.rollMode];
  rollModeButton.dataset.mode = state.rollMode;
}

function cycleRollMode(direction) {
  const currentIndex = ROLL_MODES.indexOf(state.rollMode);
  const nextIndex = (currentIndex + direction + ROLL_MODES.length) % ROLL_MODES.length;
  state.rollMode = ROLL_MODES[nextIndex];
  syncRollModeUi();
}

function createEmptyGroup() {
  return {
    id: crypto.randomUUID(),
    name: `Custom Group ${state.groups.length + 1}`,
    shortName: "",
    color: STAGE_GROUP_PALETTE[state.groups.length % STAGE_GROUP_PALETTE.length]?.face ?? "#d95f43",
    equation: "",
    damageType: "",
    selected: false,
    collapsed: true,
  };
}

function formatDiceSummary(group) {
  return group.equation?.trim() ? group.equation.replaceAll(" ", "") : "No dice configured";
}

function renderGroups() {
  groupsContainer.innerHTML = "";

  state.groups.forEach((group) => {
    const fragment = groupTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".group-card");
    const nameInput = fragment.querySelector('[data-field="name"]');
    const shortNameInput = fragment.querySelector('[data-field="shortName"]');
    const equationInput = fragment.querySelector('[data-field="equation"]');
    const damageTypeInput = fragment.querySelector('[data-field="damageType"]');
    const colorInput = fragment.querySelector('[data-field="color"]');
    const selectedInput = fragment.querySelector('[data-field="selected"]');
    const summary = fragment.querySelector('[data-role="summary"]');
    const tabAbbr = fragment.querySelector('[data-role="tab-abbr"]');
    const collapseToggle = fragment.querySelector('[data-action="toggle-collapse"]');
    const collapseIndicator = fragment.querySelector('[data-role="collapse-indicator"]');
    const removeButton = fragment.querySelector('[data-action="remove-group"]');

    card.dataset.groupId = group.id;
    card.draggable = true;
    card.style.setProperty("--group-accent", group.color ?? "#d95f43");
    card.classList.toggle("group-card--collapsed", group.collapsed);
    nameInput.value = group.name;
    shortNameInput.value = group.shortName ?? "";
    equationInput.value = group.equation ?? "";
    damageTypeInput.value = group.damageType ?? "";
    colorInput.value = group.color ?? "#d95f43";
    selectedInput.checked = group.selected;
    summary.textContent = formatDiceSummary(group);
    tabAbbr.textContent = group.shortName || group.name.slice(0, 4).toUpperCase();
    collapseIndicator.textContent = group.collapsed ? "▸" : "◂";

    nameInput.addEventListener("input", (event) => {
      group.name = event.target.value.trimStart().slice(0, 32) || "Unnamed Group";
      summary.textContent = formatDiceSummary(group);
      tabAbbr.textContent = group.shortName || group.name.slice(0, 4).toUpperCase();
      persistGroups();
    });

    shortNameInput.addEventListener("input", (event) => {
      group.shortName = event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
      event.target.value = group.shortName;
      tabAbbr.textContent = group.shortName || group.name.slice(0, 4).toUpperCase();
      persistGroups();
    });

    equationInput.addEventListener("input", (event) => {
      group.equation = event.target.value.slice(0, 80);
      summary.textContent = formatDiceSummary(group);
      persistGroups();
    });

    damageTypeInput.addEventListener("input", (event) => {
      group.damageType = event.target.value.trimStart().slice(0, 24);
      persistGroups();
    });

    colorInput.addEventListener("input", (event) => {
      group.color = event.target.value;
      card.style.setProperty("--group-accent", group.color);
      persistGroups();
    });

    selectedInput.addEventListener("change", (event) => {
      group.selected = event.target.checked;
      persistGroups();
    });

    card.addEventListener("click", (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLLabelElement) return;
      if (event.target.closest('[data-action="remove-group"]')) return;
      if (event.target.closest('[data-action="toggle-collapse"]')) return;

      if (group.collapsed) {
        group.selected = !group.selected;
        selectedInput.checked = group.selected;
        persistGroups();
        return;
      }
    });

    collapseToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      group.collapsed = !group.collapsed;
      persistGroups();
      render();
    });

    removeButton.addEventListener("click", () => {
      state.groups = state.groups.filter((entry) => entry.id !== group.id);
      persistGroups();
      render();
    });

    card.addEventListener("dragstart", (event) => {
      state.draggingGroupId = group.id;
      card.classList.add("group-card--dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", group.id);
      }
    });

    card.addEventListener("dragend", () => {
      state.draggingGroupId = null;
      clearDragTargets();
      render();
    });

    card.addEventListener("dragover", (event) => {
      if (!state.draggingGroupId || state.draggingGroupId === group.id) {
        return;
      }

      event.preventDefault();
      const targetIndex = state.groups.findIndex((entry) => entry.id === group.id);
      const sourceIndex = state.groups.findIndex((entry) => entry.id === state.draggingGroupId);
      const placeAfter = shouldPlaceAfter(card, event);
      clearDragTargets();
      card.classList.add(placeAfter ? "group-card--drop-after" : "group-card--drop-before");

      if (sourceIndex === -1 || targetIndex === -1) {
        return;
      }
    });

    card.addEventListener("dragleave", (event) => {
      if (!card.contains(event.relatedTarget)) {
        card.classList.remove("group-card--drop-before", "group-card--drop-after");
      }
    });

    card.addEventListener("drop", (event) => {
      if (!state.draggingGroupId || state.draggingGroupId === group.id) {
        return;
      }

      event.preventDefault();
      const placeAfter = shouldPlaceAfter(card, event);
      reorderGroups(state.draggingGroupId, group.id, placeAfter);
    });

    groupsContainer.appendChild(fragment);
  });

  groupsContainer.appendChild(addGroupButton);
}

function clearDragTargets() {
  groupsContainer.querySelectorAll(".group-card").forEach((card) => {
    card.classList.remove("group-card--drop-before", "group-card--drop-after", "group-card--dragging");
  });
}

function shouldPlaceAfter(card, event) {
  const rect = card.getBoundingClientRect();
  const yRatio = (event.clientY - rect.top) / rect.height;
  const xRatio = (event.clientX - rect.left) / rect.width;

  if (yRatio <= 0.35) {
    return false;
  }
  if (yRatio >= 0.65) {
    return true;
  }
  return xRatio >= 0.5;
}

function reorderGroups(sourceId, targetId, placeAfter) {
  const sourceIndex = state.groups.findIndex((entry) => entry.id === sourceId);
  const targetIndex = state.groups.findIndex((entry) => entry.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    clearDragTargets();
    return;
  }

  const updated = [...state.groups];
  const [moved] = updated.splice(sourceIndex, 1);
  let insertIndex = targetIndex;
  if (sourceIndex < targetIndex) {
    insertIndex -= 1;
  }
  if (placeAfter) {
    insertIndex += 1;
  }
  updated.splice(insertIndex, 0, moved);
  state.groups = updated;
  persistGroups();
  clearDragTargets();
  render();
}

function renderSavedSets() {
  if (state.savedSets.length === 0) {
    savedSetsList.className = "saved-sets-list empty-state";
    savedSetsList.textContent = "No saved sets.";
    return;
  }

  savedSetsList.className = "saved-sets-list";
  savedSetsList.innerHTML = state.savedSets
    .map(
      (set) => `
        <article class="saved-set">
          <div>
            <h3>${escapeHtml(set.name)}</h3>
            <p class="history-entry__meta">${set.groups.length} groups</p>
          </div>
          <div class="saved-set__actions">
            <button class="button button--small" data-action="load-set" data-set-id="${set.id}" type="button">Load</button>
            <button class="button button--small button--ghost" data-action="delete-set" data-set-id="${set.id}" type="button">Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  savedSetsList.querySelectorAll("[data-action='load-set']").forEach((button) => {
    button.addEventListener("click", () => {
      const set = state.savedSets.find((entry) => entry.id === button.dataset.setId);
      if (!set) {
        return;
      }
      state.groups = set.groups.map((group, index) => ({ ...normalizeGroup(group, index), collapsed: true }));
      persistGroups();
      closeDrawer();
      render();
    });
  });

  savedSetsList.querySelectorAll("[data-action='delete-set']").forEach((button) => {
    button.addEventListener("click", () => {
      state.savedSets = state.savedSets.filter((entry) => entry.id !== button.dataset.setId);
      persistSavedSets();
      renderSavedSets();
    });
  });
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function parseDiceEquation(equation) {
  const cleaned = equation.replaceAll(/\s+/g, "");
  if (!cleaned) {
    return { diceTerms: [], modifier: 0 };
  }

  const rawTerms = cleaned.match(/[+-]?[^+-]+/g);
  if (!rawTerms) {
    throw new Error(`Invalid equation: ${equation}`);
  }

  const diceTerms = [];
  let modifier = 0;

  rawTerms.forEach((term) => {
    const match = term.match(/^([+-]?)(?:(\d*)d(\d+)|(\d+))$/i);
    if (!match) {
      throw new Error(`Invalid equation term: ${term}`);
    }

    const sign = match[1] === "-" ? -1 : 1;

    if (match[3]) {
      const count = Number(match[2] || 1);
      const sides = Number(match[3]);
      if (!Number.isInteger(count) || count <= 0 || !DIE_TYPES.includes(sides)) {
        throw new Error(`Unsupported dice term: ${term}`);
      }

      diceTerms.push({ count, sides, sign });
      return;
    }

    modifier += sign * Number(match[4]);
  });

  return { diceTerms, modifier };
}

function rollGroup(group, rollMode) {
  const critEnabled = rollMode === "crit";
  const multiplier = critEnabled ? 2 : 1;
  const diceEntries = [];
  let subtotal = 0;
  const parsedEquation = parseDiceEquation(group.equation ?? "");

  const addDiceEntry = ({ sides, baseCount, sign, source }) => {
    const count = baseCount * multiplier;
    if (count === 0) {
      return;
    }

    const values =
      sides === 20 && (rollMode === "adv" || rollMode === "disadv")
        ? Array.from({ length: count }, () => {
            const pair = [rollDie(20), rollDie(20)];
            return rollMode === "adv" ? Math.max(...pair) : Math.min(...pair);
          })
        : Array.from({ length: count }, () => rollDie(sides));
    const rawTotal = values.reduce((sum, value) => sum + value, 0);
    const total = rawTotal * sign;
    subtotal += total;
    diceEntries.push({
      sides,
      count,
      baseCount,
      sign,
      values,
      total,
      source,
      rollMode,
    });
  };

  parsedEquation.diceTerms.forEach((term) => {
    addDiceEntry({
      sides: term.sides,
      baseCount: term.count,
      sign: term.sign,
      source: "equation",
    });
  });

  const totalModifier = parsedEquation.modifier;

  return {
    groupId: group.id,
    name: group.name,
    color: group.color,
    damageType: (group.damageType || "untyped").trim() || "untyped",
    rollMode,
    critEnabled,
    equation: group.equation ?? "",
    modifier: totalModifier,
    baseModifier: 0,
    equationModifier: parsedEquation.modifier,
    diceEntries,
    diceTotal: subtotal,
    total: subtotal + totalModifier,
  };
}

function performRoll(groupIds, rollMode) {
  if (state.rollAnimating) {
    return;
  }

  const groups = state.groups.filter((group) => groupIds.includes(group.id));
  if (groups.length === 0) {
    return;
  }

  let groupResults;
  try {
    groupResults = groups.map((group) => rollGroup(group, rollMode));
  } catch (error) {
    window.alert(error.message);
    return;
  }

  const total = groupResults.reduce((sum, result) => sum + result.total, 0);
  const label = groups.length === 1 ? groupResults[0].name : "Combined Roll";
  const critEnabled = rollMode === "crit";

  const result = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    label,
    critEnabled,
    rollMode,
    total,
    groupResults,
    damageTotals: aggregateDamageTotals(groupResults),
  };

  state.lastResult = result;
  state.history.unshift(result);
  state.rollAnimating = true;
  render();

  startStageRoll(result).finally(() => {
    state.rollAnimating = false;
    render();
  });
}

function aggregateDamageTotals(groupResults) {
  const totals = new Map();
  groupResults.forEach((result) => {
    totals.set(result.damageType, (totals.get(result.damageType) || 0) + result.total);
  });

  return Array.from(totals.entries()).map(([type, total]) => ({ type, total }));
}

function renderGroupResult(result) {
  const spinnerMarkup = renderSpinner(result);
  const diceMarkup =
    result.diceEntries.length > 0
      ? result.diceEntries
          .map((entry) => {
            const signedBaseCount = `${entry.sign < 0 ? "-" : ""}${entry.baseCount}d${entry.sides}`;
            const signedCount = `${entry.sign < 0 ? "-" : ""}${entry.count}d${entry.sides}`;
            const baseLabel =
              result.critEnabled && entry.baseCount > 0 ? `${signedBaseCount} -> ${signedCount}` : signedCount;
            const totalLabel = entry.total > 0 ? entry.total : `-${Math.abs(entry.total)}`;
            const sourceLabel = entry.source === "equation" ? " equation" : "";

            return `
              <div class="result-dice-line">
                <strong>${baseLabel}${sourceLabel}</strong>
                <span>[${entry.values.join(", ")}] = ${totalLabel}</span>
              </div>
            `;
          })
          .join("")
      : '<div class="result-dice-line"><strong>No dice</strong><span>Flat modifier only</span></div>';

  const modifierParts = [];
  if (result.equationModifier !== 0) {
    modifierParts.push(
      result.equationModifier > 0
        ? `equation +${result.equationModifier}`
        : `equation ${result.equationModifier}`
    );
  }
  const modifierText = modifierParts.length ? modifierParts.join(" • ") : "No flat adjustment";
  const equationText = result.equation.trim() ? `Equation: ${escapeHtml(result.equation.replaceAll(" ", ""))}` : "";

  return `
    <section class="result-group">
      <div class="result-visual">
        ${spinnerMarkup}
        <div class="result-content">
          <div class="result-topline">
            <div>
              <h3>${escapeHtml(result.name)}</h3>
              <p class="result-meta">${escapeHtml(result.damageType)} • ${modifierText}</p>
              ${equationText ? `<p class="result-meta">${equationText}</p>` : ""}
            </div>
            <div class="result-total">
              <span>Group</span>
              <strong>${result.total}</strong>
            </div>
          </div>
          <div class="result-dice-line">${diceMarkup}</div>
        </div>
      </div>
    </section>
  `;
}

function renderSpinner(result) {
  if (result.diceEntries.length === 0) {
    return `
      <div class="spinner-wheel spinner-wheel--empty">
        <div class="spinner-core">
          <span class="spinner-core__caption">mod</span>
          <strong>${result.total}</strong>
        </div>
      </div>
    `;
  }

  const dialMarkup = result.diceEntries
    .map((entry, index) => {
      const dialSize = 168 - index * 22;
      const maxRoll = Math.max(1, entry.count * entry.sides);
      const magnitude = Math.min(100, Math.max(12, Math.round((Math.abs(entry.total) / maxRoll) * 100)));
      const rotation = (entry.values.reduce((sum, value) => sum + value, 0) * 19 + entry.sides * 11 + index * 37) % 360;
      const color = DIE_COLORS[entry.sides] ?? "#c3d5ff";
      const label = `${entry.sign < 0 ? "-" : ""}${entry.count}d${entry.sides}`;

      return `
        <div
          class="spinner-dial"
          style="--dial-size:${dialSize}px; --dial-rotation:${rotation}deg; --dial-fill:${magnitude}%; --dial-color:${color};"
        >
          <span class="spinner-dial__label">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="spinner-wheel ${state.rollAnimating ? "spinner-wheel--rolling" : ""}">
      ${dialMarkup}
      <div class="spinner-core">
        <span class="spinner-core__caption">${result.critEnabled ? "crit" : "roll"}</span>
        <strong>${result.total}</strong>
      </div>
    </div>
  `;
}

function renderHistory() {
  if (state.history.length === 0) {
    historySheet.classList.add("history-sheet--hidden");
    historyContainer.className = "history-list empty-state";
    historyContainer.textContent = "No rolls yet.";
    historySheet.classList.remove("history-sheet--open");
    return;
  }

  historySheet.classList.remove("history-sheet--hidden");
  historySheet.classList.toggle("history-sheet--open", state.historyOpen);
  historyContainer.className = "history-list";
  historyContainer.innerHTML = "";

  state.history.forEach((entry) => {
    const fragment = historyTemplate.content.cloneNode(true);
    fragment.querySelector('[data-role="title"]').textContent = entry.label;
    fragment.querySelector('[data-role="total"]').textContent = `Total ${entry.total}`;
    fragment.querySelector('[data-role="meta"]').textContent = `${formatTime(entry.createdAt)} • ${
      ROLL_MODE_LABELS[entry.rollMode] || "Normal"
    }`;
    const detailLines = entry.groupResults.map(
      (groupResult) =>
        `<div><strong>${escapeHtml(groupResult.name)}:</strong> ${escapeHtml(
          summarizeResult(groupResult)
        )}</div>`
    );
    detailLines.push(
      `<div><strong>Damage:</strong> ${entry.damageTotals
        .map((damage) => `${damage.type} ${damage.total}`)
        .join(" • ")}</div>`
    );
    fragment.querySelector('[data-role="detail"]').innerHTML = detailLines.join("");
    historyContainer.appendChild(fragment);
  });
}

function summarizeResult(result) {
  const dice = result.diceEntries
    .map((entry) => `${entry.sign < 0 ? "-" : ""}${entry.count}d${entry.sides} [${entry.values.join(", ")}]`)
    .join("; ");
  const modifier =
    result.modifier === 0 ? "" : result.modifier > 0 ? ` +${result.modifier}` : ` ${result.modifier}`;
  return `${dice || "no dice"}${modifier} = ${result.total}`;
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function render() {
  renderGroups();
  renderHistory();
  renderSavedSets();
  renderDiceStageSummary(state.lastResult);
  savedSetsDrawer.classList.toggle("drawer--open", state.drawerOpen);
  drawerBackdrop.classList.toggle("drawer-backdrop--open", state.drawerOpen);
  savedSetsDrawer.setAttribute("aria-hidden", String(!state.drawerOpen));
  document.body.classList.toggle("drawer-open", state.drawerOpen);
  document.body.classList.toggle("roll-animating", state.rollAnimating);
}

function openDrawer() {
  state.drawerOpen = true;
  render();
}

function closeDrawer() {
  state.drawerOpen = false;
  render();
}

function rollSelectedGroups() {
  performRoll(
    state.groups.filter((group) => group.selected).map((group) => group.id),
    state.rollMode
  );
}

function exportGroupsAsJson() {
  const json = JSON.stringify(state.groups, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dice-groups.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importGroupsFromJson(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!Array.isArray(parsed)) {
        window.alert("Invalid file: expected a JSON array of groups.");
        return;
      }
      const normalized = parsed.map((group, index) => normalizeGroup(group, index)).filter(Boolean);
      if (normalized.length === 0) {
        window.alert("No valid groups found in file.");
        return;
      }
      state.groups = normalized;
      persistGroups();
      closeDrawer();
      render();
    } catch {
      window.alert("Failed to read file: invalid JSON.");
    }
  };
  reader.readAsText(file);
}

addGroupButton.addEventListener("click", () => {
  state.groups.push(createEmptyGroup());
  persistGroups();
  render();
});

rollModeButton.addEventListener("wheel", (event) => {
  event.preventDefault();
  cycleRollMode(event.deltaY > 0 ? 1 : -1);
});

rollModeButton.addEventListener("pointerdown", (event) => {
  rollModePointerStartY = event.clientY;
  rollModePointerMoved = false;
  rollModeButton.setPointerCapture?.(event.pointerId);
});

rollModeButton.addEventListener("pointermove", (event) => {
  if (rollModePointerStartY === null) {
    return;
  }

  const deltaY = event.clientY - rollModePointerStartY;
  if (Math.abs(deltaY) > 14) {
    cycleRollMode(deltaY > 0 ? 1 : -1);
    rollModePointerStartY = event.clientY;
    rollModePointerMoved = true;
  }
});

rollModeButton.addEventListener("pointerup", (event) => {
  if (rollModePointerStartY === null) {
    return;
  }

  if (!rollModePointerMoved) {
    rollSelectedGroups();
  }
  rollModePointerStartY = null;
  rollModePointerMoved = false;
  rollModeButton.releasePointerCapture?.(event.pointerId);
});

rollModeButton.addEventListener("pointercancel", () => {
  rollModePointerStartY = null;
  rollModePointerMoved = false;
});

diceStagePanel?.addEventListener("click", (event) => {
  if (event.target.closest("#roll-mode-button")) {
    return;
  }
  rollSelectedGroups();
});

clearHistoryButton.addEventListener("click", () => {
  state.history = [];
  state.historyOpen = false;
  render();
});

openSavedSetsButton.addEventListener("click", openDrawer);
closeSavedSetsButton.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

saveCurrentSetButton.addEventListener("click", () => {
  const name = savedSetNameInput.value.trim() || `Set ${state.savedSets.length + 1}`;
  state.savedSets.unshift({
    id: crypto.randomUUID(),
    name,
    groups: state.groups.map((group, index) => normalizeGroup(group, index)),
  });
  savedSetNameInput.value = "";
  persistSavedSets();
  renderSavedSets();
});

toggleHistoryButton.addEventListener("click", () => {
  if (state.history.length === 0) {
    return;
  }
  state.historyOpen = !state.historyOpen;
  renderHistory();
});

toggleHistoryButton.addEventListener("pointerdown", (event) => {
  historyPointerStartY = event.clientY;
  toggleHistoryButton.setPointerCapture?.(event.pointerId);
});

toggleHistoryButton.addEventListener("pointerup", (event) => {
  if (historyPointerStartY === null) {
    return;
  }

  const deltaY = event.clientY - historyPointerStartY;
  if (deltaY > 24 && state.historyOpen) {
    state.historyOpen = false;
    renderHistory();
  } else if (deltaY < -24 && !state.historyOpen && state.history.length > 0) {
    state.historyOpen = true;
    renderHistory();
  }

  historyPointerStartY = null;
  toggleHistoryButton.releasePointerCapture?.(event.pointerId);
});

toggleHistoryButton.addEventListener("pointercancel", () => {
  historyPointerStartY = null;
});

exportGroupsButton.addEventListener("click", exportGroupsAsJson);

importGroupsInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    importGroupsFromJson(file);
  }
  event.target.value = "";
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.drawerOpen) {
    closeDrawer();
  }
});

initializeDiceStage();
syncRollModeUi();
render();
