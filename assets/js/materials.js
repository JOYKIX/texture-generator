const MATERIALS = {
  wood: {
    label: 'Bois HD',
    swatch: 'repeating-linear-gradient(90deg, #2a1409, #c4874f 6px, #1a0b05 13px)',
    base: [76, 38, 18],
  },
  steel: {
    label: 'Acier brossé',
    swatch: 'linear-gradient(90deg, #1b2028, #d3d8df, #303744)',
    base: [86, 91, 100],
  },
  stone: {
    label: 'Pierre sculptée',
    swatch: 'linear-gradient(135deg, #22242a, #777b82 45%, #15171b)',
    base: [74, 76, 79],
  },
  copper: {
    label: 'Cuivre riveté',
    swatch: 'linear-gradient(90deg, #52240d, #d98a44, #52b98f)',
    base: [155, 84, 39],
  },
  emissive: {
    label: 'Émissif cristal',
    swatch: 'radial-gradient(circle, #f8fbff, #62e9ff 35%, #5731ff 72%, #09031d)',
    base: [45, 198, 255],
  },
};

export function getMaterialDefinitions() {
  return MATERIALS;
}

export function createMaterialTexture(context, zone, options = {}) {
  const material = MATERIALS[zone.material] ? zone.material : 'wood';
  const quality = options.quality ?? 1;
  const seed = options.seed ?? 0;

  if (material === 'steel') return createSteelTexture(context, zone, seed, quality);
  if (material === 'stone') return createStoneTexture(context, zone, seed, quality);
  if (material === 'copper') return createCopperTexture(context, zone, seed, quality);
  if (material === 'emissive') return createEmissiveTexture(context, zone, seed, quality);
  return createWoodTexture(context, zone, seed, quality);
}

export function createWoodTexture(context, zone, seed = 0, quality = 1) {
  const imageData = context.createImageData(zone.width, zone.height);
  const horizontal = zone.width >= zone.height;

  forEachPixel(zone, (x, y) => {
    const grainAxis = horizontal ? y : x;
    const lengthAxis = horizontal ? x : y;
    const longWave = fbm(lengthAxis * 0.025, seed * 0.31, 4 + quality);
    const grain = Math.sin((grainAxis + longWave * 22) * (0.42 + quality * 0.08)) * 0.5 + 0.5;
    const rings = Math.sin((grainAxis * 0.18 + fbm(x * 0.045, y * 0.045 + seed, 5) * 7) + seed) * 0.5 + 0.5;
    const pore = fbm(x * 0.42 + seed, y * 0.42 - seed, 3 + quality);
    const knotDistance = Math.hypot(x - zone.width * (0.35 + seeded(seed) * 0.35), y - zone.height * (0.35 + seeded(seed + 2) * 0.3));
    const knot = smoothstep(0.42, 0.02, knotDistance / Math.max(8, Math.min(zone.width, zone.height)));
    const bevel = edgeFalloff(x, y, zone.width, zone.height);
    const tone = clamp(0.24 + grain * 0.34 + rings * 0.2 + pore * 0.16 - knot * 0.22 + bevel * 0.18, 0, 1);
    const stripe = Math.sin(grainAxis * 1.7 + longWave * 5) > 0.82 ? 0.12 : 0;

    setPixel(imageData, x, y, colorGrade({
      r: 48 + tone * 150 + stripe * 80,
      g: 24 + tone * 88 + stripe * 38,
      b: 10 + tone * 45,
      a: 255,
    }, bevel));
  });

  return imageData;
}

export function createSteelTexture(context, zone, seed = 0, quality = 1) {
  const imageData = context.createImageData(zone.width, zone.height);
  const horizontal = zone.width >= zone.height;

  forEachPixel(zone, (x, y) => {
    const brushedAxis = horizontal ? x : y;
    const crossAxis = horizontal ? y : x;
    const band = Math.sin(brushedAxis * 0.16 + fbm(crossAxis * 0.12, seed, 4) * 2.2 + seed) * 0.5 + 0.5;
    const scratch = Math.pow(fbm(brushedAxis * 0.018 + seed, crossAxis * 1.35, 5 + quality), 2.2);
    const micro = fbm(x * 0.9, y * 0.9 + seed, 3);
    const bevel = edgeFalloff(x, y, zone.width, zone.height);
    const seam = gridLine(x, y, zone.width, zone.height, 16);
    const tone = clamp(0.26 + band * 0.18 + scratch * 0.28 + micro * 0.09 + bevel * 0.24 - seam * 0.16, 0, 1);

    setPixel(imageData, x, y, {
      r: 48 + tone * 176,
      g: 53 + tone * 176,
      b: 62 + tone * 182,
      a: 255,
    });
  });

  return imageData;
}

function createStoneTexture(context, zone, seed = 0, quality = 1) {
  const imageData = context.createImageData(zone.width, zone.height);

  forEachPixel(zone, (x, y) => {
    const cells = voronoi(x * 0.11, y * 0.11, seed);
    const crack = smoothstep(0.12, 0.01, cells.edge);
    const chip = fbm(x * 0.34 + seed, y * 0.34, 4 + quality);
    const bevel = edgeFalloff(x, y, zone.width, zone.height);
    const carved = gridLine(x, y, zone.width, zone.height, 16) * 0.25;
    const tone = clamp(0.25 + chip * 0.42 + cells.cell * 0.22 + bevel * 0.2 - crack * 0.28 - carved, 0, 1);

    setPixel(imageData, x, y, {
      r: 42 + tone * 118,
      g: 44 + tone * 118,
      b: 48 + tone * 124,
      a: 255,
    });
  });

  return imageData;
}

function createCopperTexture(context, zone, seed = 0, quality = 1) {
  const imageData = context.createImageData(zone.width, zone.height);

  forEachPixel(zone, (x, y) => {
    const plate = Math.sin((zone.width >= zone.height ? x : y) * 0.23 + seed) * 0.5 + 0.5;
    const patina = smoothstep(0.58, 0.95, fbm(x * 0.12 + seed, y * 0.12, 5 + quality));
    const rivet = rivetMask(x, y, zone.width, zone.height);
    const bevel = edgeFalloff(x, y, zone.width, zone.height);
    const tone = clamp(0.32 + plate * 0.26 + fbm(x * 0.55, y * 0.55 + seed, 3) * 0.16 + bevel * 0.18 + rivet * 0.24, 0, 1);

    setPixel(imageData, x, y, {
      r: (88 + tone * 166) * (1 - patina * 0.42) + 37 * patina,
      g: (38 + tone * 78) * (1 - patina * 0.12) + 160 * patina,
      b: (15 + tone * 38) * (1 - patina * 0.18) + 123 * patina,
      a: 255,
    });
  });

  return imageData;
}

function createEmissiveTexture(context, zone, seed = 0, quality = 1) {
  const imageData = context.createImageData(zone.width, zone.height);

  forEachPixel(zone, (x, y) => {
    const nx = x / Math.max(1, zone.width - 1) - 0.5;
    const ny = y / Math.max(1, zone.height - 1) - 0.5;
    const core = 1 - clamp(Math.hypot(nx, ny) * 1.9, 0, 1);
    const vein = Math.pow(Math.abs(Math.sin((x + y) * 0.22 + fbm(x * 0.1, y * 0.1 + seed, 4 + quality) * 5)), 9);
    const pulse = fbm(x * 0.18 + seed, y * 0.18, 4);
    const bevel = edgeFalloff(x, y, zone.width, zone.height);
    const glow = clamp(core * 0.64 + vein * 0.35 + pulse * 0.18 + bevel * 0.12, 0, 1);

    setPixel(imageData, x, y, {
      r: 15 + glow * 210 + vein * 35,
      g: 42 + glow * 185 + vein * 56,
      b: 92 + glow * 160,
      a: 255,
    });
  });

  return imageData;
}

function forEachPixel(zone, callback) {
  for (let y = 0; y < zone.height; y += 1) {
    for (let x = 0; x < zone.width; x += 1) callback(x, y);
  }
}

function setPixel(imageData, x, y, color) {
  const index = (y * imageData.width + x) * 4;
  imageData.data[index] = clamp(Math.round(color.r), 0, 255);
  imageData.data[index + 1] = clamp(Math.round(color.g), 0, 255);
  imageData.data[index + 2] = clamp(Math.round(color.b), 0, 255);
  imageData.data[index + 3] = color.a;
}

function colorGrade(color, bevel) {
  return {
    r: color.r + bevel * 16,
    g: color.g + bevel * 10,
    b: color.b + bevel * 5,
    a: color.a,
  };
}

function noise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = noise(xi, yi);
  const b = noise(xi + 1, yi);
  const c = noise(xi, yi + 1);
  const d = noise(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, octaves = 5) {
  let total = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let normalizer = 0;

  for (let i = 0; i < octaves; i += 1) {
    total += smoothNoise(x * frequency, y * frequency) * amplitude;
    normalizer += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / normalizer;
}

function voronoi(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let nearest = 99;
  let second = 99;
  let cell = 0;

  for (let yy = -1; yy <= 1; yy += 1) {
    for (let xx = -1; xx <= 1; xx += 1) {
      const px = ix + xx + noise(ix + xx + seed, iy + yy);
      const py = iy + yy + noise(ix + xx, iy + yy + seed);
      const dist = Math.hypot(x - px, y - py);
      if (dist < nearest) {
        second = nearest;
        nearest = dist;
        cell = noise(ix + xx + seed * 2, iy + yy - seed);
      } else if (dist < second) {
        second = dist;
      }
    }
  }

  return { edge: second - nearest, cell };
}

function edgeFalloff(x, y, width, height) {
  const distance = Math.min(x, y, width - 1 - x, height - 1 - y);
  return clamp(distance / Math.max(1, Math.min(width, height) * 0.2), 0, 1);
}

function gridLine(x, y, width, height, cell) {
  if (width < cell * 2 || height < cell * 2) return 0;
  const lineX = Math.min(x % cell, cell - (x % cell));
  const lineY = Math.min(y % cell, cell - (y % cell));
  return Math.max(smoothstep(1.8, 0, lineX), smoothstep(1.8, 0, lineY));
}

function rivetMask(x, y, width, height) {
  const spacing = Math.max(10, Math.min(width, height) / 3);
  const margin = Math.min(width, height) * 0.16;
  let maxRivet = 0;

  for (let yy = margin; yy <= height - margin; yy += spacing) {
    for (let xx = margin; xx <= width - margin; xx += spacing) {
      const d = Math.hypot(x - xx, y - yy);
      maxRivet = Math.max(maxRivet, smoothstep(spacing * 0.22, 0, d));
    }
  }

  return maxRivet;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function seeded(value) {
  return noise(value * 19.19, value * 4.7);
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
