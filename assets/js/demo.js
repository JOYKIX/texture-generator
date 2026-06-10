import { createMaterialTexture } from './materials.js';

export function buildDemoTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, size, size);

  const rectangles = [
    { x: 14, y: 18, width: 34, height: 142, material: 'wood' },
    { x: 58, y: 18, width: 42, height: 142, material: 'wood' },
    { x: 112, y: 18, width: 38, height: 142, material: 'copper' },
    { x: 170, y: 30, width: 178, height: 18, material: 'steel' },
    { x: 170, y: 62, width: 220, height: 28, material: 'wood' },
    { x: 168, y: 110, width: 205, height: 16, material: 'emissive' },
    { x: 48, y: 184, width: 144, height: 18, material: 'steel' },
    { x: 208, y: 178, width: 72, height: 68, material: 'stone' },
    { x: 294, y: 180, width: 86, height: 20, material: 'steel' },
    { x: 294, y: 212, width: 130, height: 14, material: 'copper' },
  ];

  rectangles.forEach((rect, index) => {
    const imageData = createMaterialTexture(context, rect, { seed: index, quality: 2 });
    context.putImageData(imageData, rect.x, rect.y);
  });

  return canvas.toDataURL('image/png');
}
