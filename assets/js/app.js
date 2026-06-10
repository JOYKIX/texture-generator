import { buildDemoTexture } from './demo.js';
import { createMaterialTexture, getMaterialDefinitions } from './materials.js';
import { scanTexture as detectTextureZones } from './scanner.js';

const MATERIALS = getMaterialDefinitions();
const EXPORT_PRESETS = [16, 32, 64, 128, 256, 512, 1024];
const DEFAULT_RESOLUTION = 256;

const state = {
  image: null,
  zones: [],
  selectedZoneId: null,
  overlayVisible: true,
  generated: false,
  outputSize: DEFAULT_RESOLUTION,
};

const elements = {
  fileInput: document.querySelector('#fileInput'),
  dropzone: document.querySelector('#dropzone'),
  sourceCanvas: document.querySelector('#sourceCanvas'),
  overlayCanvas: document.querySelector('#overlayCanvas'),
  resultCanvas: document.querySelector('#resultCanvas'),
  zonesList: document.querySelector('#zonesList'),
  zoneTemplate: document.querySelector('#zoneTemplate'),
  imageInfo: document.querySelector('#imageInfo'),
  zoneInfo: document.querySelector('#zoneInfo'),
  outputInfo: document.querySelector('#outputInfo'),
  thresholdInput: document.querySelector('#thresholdInput'),
  minAreaInput: document.querySelector('#minAreaInput'),
  detailInput: document.querySelector('#detailInput'),
  resolutionSelect: document.querySelector('#resolutionSelect'),
  rescanButton: document.querySelector('#rescanButton'),
  generateButton: document.querySelector('#generateButton'),
  downloadButton: document.querySelector('#downloadButton'),
  renderState: document.querySelector('#renderState'),
  loadDemoButton: document.querySelector('#loadDemoButton'),
  toggleOverlayButton: document.querySelector('#toggleOverlayButton'),
};

const sourceContext = elements.sourceCanvas.getContext('2d', { willReadFrequently: true });
const overlayContext = elements.overlayCanvas.getContext('2d');
const resultContext = elements.resultCanvas.getContext('2d');

function initializeMaterialControls() {
  document.querySelectorAll('[data-material-name]').forEach((node) => {
    const material = MATERIALS[node.dataset.materialName];
    if (material) node.textContent = material.label;
  });

  document.querySelectorAll('[data-material-swatch]').forEach((node) => {
    const material = MATERIALS[node.dataset.materialSwatch];
    if (material) node.style.setProperty('--swatch', material.swatch);
  });
}

function setCanvasSize(width, height) {
  [elements.sourceCanvas, elements.overlayCanvas, elements.resultCanvas].forEach((canvas) => {
    canvas.width = width;
    canvas.height = height;
  });
}

function clearCanvas(canvas, context) {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawImageToSource(image) {
  const outputSize = readOutputSize(image);
  setCanvasSize(outputSize, outputSize);
  sourceContext.imageSmoothingEnabled = false;
  resultContext.imageSmoothingEnabled = false;
  sourceContext.clearRect(0, 0, outputSize, outputSize);
  sourceContext.drawImage(image, 0, 0, outputSize, outputSize);
  resultContext.clearRect(0, 0, outputSize, outputSize);
  resultContext.drawImage(image, 0, 0, outputSize, outputSize);
  elements.imageInfo.textContent = `${image.width} × ${image.height}px source`;
  elements.outputInfo.textContent = `${outputSize} × ${outputSize}px export`;
}

function readOutputSize(image = state.image) {
  const selected = elements.resolutionSelect.value;
  if (selected === 'native' && image) return Math.max(image.width, image.height);
  const parsed = Number(selected);
  return EXPORT_PRESETS.includes(parsed) ? parsed : DEFAULT_RESOLUTION;
}

function scanTexture() {
  if (!state.image) return;

  state.outputSize = readOutputSize();
  drawImageToSource(state.image);
  const imageData = sourceContext.getImageData(0, 0, elements.sourceCanvas.width, elements.sourceCanvas.height);
  state.zones = detectTextureZones(imageData, {
    threshold: Number(elements.thresholdInput.value),
    minArea: Number(elements.minAreaInput.value),
  });
  state.selectedZoneId = state.zones[0]?.id ?? null;
  state.generated = false;
  elements.downloadButton.disabled = true;
  elements.renderState.textContent = 'Prêt à générer';
  renderZonesList();
  drawOverlay();
  updateStats();
}

function renderZonesList() {
  elements.zonesList.innerHTML = '';

  if (state.zones.length === 0) {
    elements.zonesList.innerHTML = '<p class="empty-state">Aucune zone détectée. Essaie de baisser la tolérance ou la surface minimale.</p>';
    return;
  }

  state.zones.forEach((zone, index) => {
    const fragment = elements.zoneTemplate.content.cloneNode(true);
    const item = fragment.querySelector('.zone-item');
    const preview = fragment.querySelector('.zone-item__preview');
    const title = fragment.querySelector('strong');
    const details = fragment.querySelector('small');
    const select = fragment.querySelector('select');

    fillMaterialOptions(select);
    item.classList.toggle('is-selected', zone.id === state.selectedZoneId);
    preview.style.background = MATERIALS[zone.material]?.swatch ?? MATERIALS.wood.swatch;
    title.textContent = `Zone ${index + 1}`;
    details.textContent = `${zone.width}×${zone.height}px · x${zone.x}, y${zone.y} · ${(zone.rectangularity * 100).toFixed(0)}% plein`;
    select.value = zone.material;
    preview.addEventListener('click', () => selectZone(zone.id));
    item.addEventListener('click', (event) => {
      if (event.target !== select) selectZone(zone.id);
    });
    select.addEventListener('change', (event) => {
      zone.material = event.target.value;
      state.generated = false;
      elements.downloadButton.disabled = true;
      elements.renderState.textContent = 'Modifié';
      renderZonesList();
      drawOverlay();
    });

    elements.zonesList.appendChild(fragment);
  });
}

function fillMaterialOptions(select) {
  select.innerHTML = '';
  Object.entries(MATERIALS).forEach(([value, material]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = material.label;
    select.appendChild(option);
  });
}

function selectZone(zoneId) {
  state.selectedZoneId = zoneId;
  renderZonesList();
  drawOverlay();
}

function drawOverlay() {
  clearCanvas(elements.overlayCanvas, overlayContext);
  if (!state.overlayVisible) return;

  state.zones.forEach((zone, index) => {
    const selected = zone.id === state.selectedZoneId;
    const hue = getMaterialHue(zone.material);
    overlayContext.save();
    overlayContext.lineWidth = selected ? 4 : 2;
    overlayContext.strokeStyle = selected ? '#ffecb3' : `hsl(${hue} 100% 70%)`;
    overlayContext.fillStyle = `hsla(${hue} 100% 62% / ${selected ? 0.2 : 0.12})`;
    overlayContext.fillRect(zone.x, zone.y, zone.width, zone.height);
    overlayContext.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.width - 1, zone.height - 1);
    overlayContext.fillStyle = selected ? '#ffecb3' : '#ffffff';
    overlayContext.font = `${Math.max(10, Math.min(18, zone.height / 2))}px Inter, sans-serif`;
    overlayContext.fillText(String(index + 1), zone.x + 4, zone.y + Math.min(zone.height - 4, 18));
    overlayContext.restore();
  });
}

function getMaterialHue(material) {
  return {
    wood: 28,
    steel: 202,
    stone: 260,
    copper: 18,
    emissive: 184,
  }[material] ?? 35;
}

function updateStats() {
  elements.zoneInfo.textContent = `${state.zones.length} zone${state.zones.length > 1 ? 's' : ''}`;
  elements.outputInfo.textContent = `${elements.resultCanvas.width} × ${elements.resultCanvas.height}px export`;
}

function generateTexture() {
  if (!state.image || state.zones.length === 0) return;

  if (elements.resultCanvas.width !== readOutputSize()) scanTexture();

  resultContext.imageSmoothingEnabled = false;
  resultContext.clearRect(0, 0, elements.resultCanvas.width, elements.resultCanvas.height);
  resultContext.drawImage(state.image, 0, 0, elements.resultCanvas.width, elements.resultCanvas.height);

  const quality = Number(elements.detailInput.value);
  state.zones.forEach((zone, index) => {
    const texture = createMaterialTexture(resultContext, zone, { seed: index + zone.x * 0.013 + zone.y * 0.017, quality });
    resultContext.putImageData(texture, zone.x, zone.y);
  });

  state.generated = true;
  elements.downloadButton.disabled = false;
  elements.renderState.textContent = `Texture prête · ${elements.resultCanvas.width}px`;
}

function applyMaterialToAll(material) {
  state.zones.forEach((zone) => {
    zone.material = material;
  });
  state.generated = false;
  elements.downloadButton.disabled = true;
  elements.renderState.textContent = 'Matériaux appliqués';
  renderZonesList();
  drawOverlay();
}

function downloadResult() {
  if (!state.generated) return;
  const link = document.createElement('a');
  link.download = `texture-materialized-${elements.resultCanvas.width}x${elements.resultCanvas.height}.png`;
  link.href = elements.resultCanvas.toDataURL('image/png');
  link.click();
}

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.addEventListener('load', () => loadImage(reader.result));
  reader.readAsDataURL(file);
}

function loadImage(source) {
  const image = new Image();
  image.addEventListener('load', () => {
    state.image = image;
    scanTexture();
    generateTexture();
  });
  image.src = source;
}

initializeMaterialControls();
elements.fileInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
elements.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  elements.dropzone.classList.add('is-dragging');
});
elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('is-dragging'));
elements.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove('is-dragging');
  handleFile(event.dataTransfer.files[0]);
});
elements.rescanButton.addEventListener('click', scanTexture);
elements.generateButton.addEventListener('click', generateTexture);
elements.downloadButton.addEventListener('click', downloadResult);
elements.loadDemoButton.addEventListener('click', () => loadImage(buildDemoTexture()));
elements.resolutionSelect.addEventListener('change', () => {
  if (!state.image) return;
  scanTexture();
  generateTexture();
});
elements.detailInput.addEventListener('input', () => {
  if (state.image && state.zones.length) generateTexture();
});
elements.toggleOverlayButton.addEventListener('click', () => {
  state.overlayVisible = !state.overlayVisible;
  elements.toggleOverlayButton.textContent = state.overlayVisible ? 'Masquer zones' : 'Afficher zones';
  drawOverlay();
});
document.querySelectorAll('[data-apply-all]').forEach((button) => {
  button.addEventListener('click', () => applyMaterialToAll(button.dataset.applyAll));
});

clearCanvas(elements.sourceCanvas, sourceContext);
clearCanvas(elements.overlayCanvas, overlayContext);
clearCanvas(elements.resultCanvas, resultContext);
loadImage(buildDemoTexture());
