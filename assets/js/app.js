import { buildDemoTexture } from './demo.js';
import { createSteelTexture, createWoodTexture } from './materials.js';
import { scanTexture as detectTextureZones } from './scanner.js';

const state = {
  image: null,
  zones: [],
  selectedZoneId: null,
  overlayVisible: true,
  generated: false,
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
  thresholdInput: document.querySelector('#thresholdInput'),
  minAreaInput: document.querySelector('#minAreaInput'),
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
  setCanvasSize(image.width, image.height);
  sourceContext.clearRect(0, 0, image.width, image.height);
  sourceContext.drawImage(image, 0, 0);
  resultContext.clearRect(0, 0, image.width, image.height);
  resultContext.drawImage(image, 0, 0);
  elements.imageInfo.textContent = `${image.width} × ${image.height}px`;
}

function scanTexture() {
  if (!state.image) return;

  const imageData = sourceContext.getImageData(0, 0, elements.sourceCanvas.width, elements.sourceCanvas.height);
  state.zones = detectTextureZones(imageData, {
    threshold: Number(elements.thresholdInput.value),
    minArea: Number(elements.minAreaInput.value),
  });
  state.selectedZoneId = state.zones[0]?.id ?? null;
  state.generated = false;
  elements.downloadButton.disabled = true;
  elements.renderState.textContent = 'En attente';
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

    item.classList.toggle('is-selected', zone.id === state.selectedZoneId);
    preview.style.background = zone.material === 'wood'
      ? 'repeating-linear-gradient(90deg, #3a2014, #b47445 7px, #190d08 12px)'
      : 'linear-gradient(90deg, #20242c, #a6abb3, #171a20)';
    title.textContent = `Zone ${index + 1}`;
    details.textContent = `${zone.width}×${zone.height}px · x${zone.x}, y${zone.y}`;
    select.value = zone.material;
    preview.addEventListener('click', () => selectZone(zone.id));
    item.addEventListener('click', (event) => {
      if (event.target !== select) selectZone(zone.id);
    });
    select.addEventListener('change', (event) => {
      zone.material = event.target.value;
      renderZonesList();
      drawOverlay();
    });

    elements.zonesList.appendChild(fragment);
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
    overlayContext.save();
    overlayContext.lineWidth = selected ? 4 : 2;
    overlayContext.strokeStyle = selected ? '#ffdd8a' : zone.material === 'wood' ? '#ff9d4d' : '#74d2ff';
    overlayContext.fillStyle = zone.material === 'wood' ? 'rgba(255, 157, 77, 0.13)' : 'rgba(116, 210, 255, 0.13)';
    overlayContext.fillRect(zone.x, zone.y, zone.width, zone.height);
    overlayContext.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.width - 1, zone.height - 1);
    overlayContext.fillStyle = selected ? '#ffdd8a' : '#ffffff';
    overlayContext.font = `${Math.max(10, Math.min(18, zone.height / 2))}px Inter, sans-serif`;
    overlayContext.fillText(String(index + 1), zone.x + 4, zone.y + Math.min(zone.height - 4, 18));
    overlayContext.restore();
  });
}

function updateStats() {
  elements.zoneInfo.textContent = `${state.zones.length} zone${state.zones.length > 1 ? 's' : ''}`;
}

function generateTexture() {
  if (!state.image || state.zones.length === 0) return;

  resultContext.clearRect(0, 0, elements.resultCanvas.width, elements.resultCanvas.height);
  resultContext.drawImage(state.image, 0, 0);

  state.zones.forEach((zone, index) => {
    const texture = zone.material === 'wood'
      ? createWoodTexture(resultContext, zone, index)
      : createSteelTexture(resultContext, zone, index);
    resultContext.putImageData(texture, zone.x, zone.y);
  });

  state.generated = true;
  elements.downloadButton.disabled = false;
  elements.renderState.textContent = 'Texture prête';
}

function applyMaterialToAll(material) {
  state.zones.forEach((zone) => {
    zone.material = material;
  });
  renderZonesList();
  drawOverlay();
}

function downloadResult() {
  if (!state.generated) return;
  const link = document.createElement('a');
  link.download = 'texture-materialized.png';
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
    drawImageToSource(image);
    scanTexture();
  });
  image.src = source;
}

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
