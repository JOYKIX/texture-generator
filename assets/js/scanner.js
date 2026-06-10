export function scanTexture(imageData, options) {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const zones = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (visited[pixelIndex] || !isMaterialPixel(data, pixelIndex * 4, options.threshold)) continue;

      const component = floodFillComponent(x, y, width, height, data, visited, options.threshold);
      const boxWidth = component.maxX - component.minX + 1;
      const boxHeight = component.maxY - component.minY + 1;
      const rectangularity = component.area / (boxWidth * boxHeight);

      if (component.area >= options.minArea && boxWidth >= 3 && boxHeight >= 3 && rectangularity > 0.22) {
        zones.push({
          id: crypto.randomUUID(),
          x: component.minX,
          y: component.minY,
          width: boxWidth,
          height: boxHeight,
          area: component.area,
          rectangularity,
          material: guessMaterial(imageData, component),
        });
      }
    }
  }

  return mergeNearbyZones(zones).sort((a, b) => a.y - b.y || a.x - b.x);
}

function isMaterialPixel(data, index, threshold) {
  const alpha = data[index + 3];
  if (alpha < 18) return false;
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return red + green + blue > threshold * 3;
}

function floodFillComponent(startX, startY, width, height, data, visited, threshold) {
  const stack = [[startX, startY]];
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;
  let area = 0;

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) continue;
    visited[pixelIndex] = 1;

    if (!isMaterialPixel(data, pixelIndex * 4, threshold)) continue;

    area += 1;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { minX, maxX, minY, maxY, area };
}

function mergeNearbyZones(zones) {
  const sorted = [...zones];
  let didMerge = true;

  while (didMerge) {
    didMerge = false;
    outer: for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (!shouldMerge(sorted[i], sorted[j])) continue;
        sorted[i] = mergeBoxes(sorted[i], sorted[j]);
        sorted.splice(j, 1);
        didMerge = true;
        break outer;
      }
    }
  }

  return sorted;
}

function shouldMerge(a, b) {
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  const sameRow = Math.abs(a.y - b.y) <= 3 && Math.abs(a.height - b.height) <= 5 && gapX <= 2;
  const sameColumn = Math.abs(a.x - b.x) <= 3 && Math.abs(a.width - b.width) <= 5 && gapY <= 2;
  return sameRow || sameColumn;
}

function mergeBoxes(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return {
    ...a,
    x,
    y,
    width: right - x,
    height: bottom - y,
    area: a.area + b.area,
    rectangularity: (a.area + b.area) / ((right - x) * (bottom - y)),
  };
}

function guessMaterial(imageData, component) {
  const width = component.maxX - component.minX + 1;
  const height = component.maxY - component.minY + 1;
  const sample = sampleAverageColor(imageData, component.minX, component.minY, width, height);
  const warmScore = sample.r - sample.b + sample.g * 0.15;
  return warmScore > 45 ? 'wood' : 'steel';
}

function sampleAverageColor(imageData, x, y, width, height) {
  const { data } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 28));

  for (let yy = y; yy < y + height; yy += step) {
    for (let xx = x; xx < x + width; xx += step) {
      const index = (yy * imageData.width + xx) * 4;
      if (data[index + 3] < 18) continue;
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    }
  }

  return count ? { r: r / count, g: g / count, b: b / count } : { r: 0, g: 0, b: 0 };
}
