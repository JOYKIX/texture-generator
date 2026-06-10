export function createWoodTexture(context, zone, seed = 0) {
  const imageData = context.createImageData(zone.width, zone.height);
  const horizontal = zone.width >= zone.height;

  for (let y = 0; y < zone.height; y += 1) {
    for (let x = 0; x < zone.width; x += 1) {
      const grainAxis = horizontal ? y : x;
      const lengthAxis = horizontal ? x : y;
      const grain = Math.sin((grainAxis + noise(lengthAxis * 0.05, seed) * 9) * 0.55) * 0.5 + 0.5;
      const fine = noise(x * 0.22 + seed, y * 0.22 - seed);
      const knot = Math.sin(Math.hypot(x - zone.width * 0.55, y - zone.height * 0.45) * 0.11 + seed) * 0.5 + 0.5;
      const tone = clamp(0.32 + grain * 0.42 + fine * 0.22 - knot * 0.10, 0, 1);
      setPixel(imageData, x, y, {
        r: 64 + tone * 126,
        g: 34 + tone * 82,
        b: 18 + tone * 44,
        a: 255,
      });
    }
  }

  return imageData;
}

export function createSteelTexture(context, zone, seed = 0) {
  const imageData = context.createImageData(zone.width, zone.height);
  const horizontal = zone.width >= zone.height;

  for (let y = 0; y < zone.height; y += 1) {
    for (let x = 0; x < zone.width; x += 1) {
      const brushedAxis = horizontal ? x : y;
      const band = Math.sin(brushedAxis * 0.18 + seed) * 0.5 + 0.5;
      const scratch = noise((horizontal ? y : x) * 1.8, brushedAxis * 0.08 + seed);
      const edgeShade = edgeFalloff(x, y, zone.width, zone.height);
      const tone = clamp(0.28 + band * 0.22 + scratch * 0.24 + edgeShade * 0.20, 0, 1);
      setPixel(imageData, x, y, {
        r: 58 + tone * 142,
        g: 61 + tone * 142,
        b: 68 + tone * 150,
        a: 255,
      });
    }
  }

  return imageData;
}

function setPixel(imageData, x, y, color) {
  const index = (y * imageData.width + x) * 4;
  imageData.data[index] = color.r;
  imageData.data[index + 1] = color.g;
  imageData.data[index + 2] = color.b;
  imageData.data[index + 3] = color.a;
}

function noise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function edgeFalloff(x, y, width, height) {
  const distance = Math.min(x, y, width - 1 - x, height - 1 - y);
  return clamp(distance / Math.max(1, Math.min(width, height) * 0.22), 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
