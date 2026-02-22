const EXAMPLES = buildExamples();

const ROLE_STYLES = {
  pivot: { text: 'pivot', color: '#ff4b78', bar: 'rgba(255, 75, 120, 0.92)', priority: 100 },
  current: { text: 'current', color: '#13d8ff', bar: 'rgba(19, 216, 255, 0.9)', priority: 90 },
  i: { text: 'i', color: '#ff4b78', bar: 'rgba(255, 75, 120, 0.92)', priority: 95 },
  j: { text: 'j', color: '#8c7dff', bar: 'rgba(140, 125, 255, 0.92)', priority: 94 },
  low: { text: 'low', color: '#4db6ff', bar: 'rgba(77, 182, 255, 0.92)', priority: 70 },
  high: { text: 'high', color: '#3bf07f', bar: 'rgba(59, 240, 127, 0.92)', priority: 70 },
  mid: { text: 'mid', color: '#ffd166', bar: 'rgba(255, 209, 102, 0.9)', priority: 72 },
  split: { text: 'split', color: '#ffa94d', bar: 'rgba(255, 169, 77, 0.92)', priority: 80 },
  key: { text: 'key', color: '#ffd166', bar: 'rgba(255, 209, 102, 0.9)', priority: 84 },
  min: { text: 'min', color: '#3bf07f', bar: 'rgba(59, 240, 127, 0.92)', priority: 84 },
  max: { text: 'max', color: '#ff9f1c', bar: 'rgba(255, 159, 28, 0.92)', priority: 84 },
  left: { text: 'left', color: '#37c6ff', bar: 'rgba(55, 198, 255, 0.9)', priority: 78 },
  right: { text: 'right', color: '#ff7aa8', bar: 'rgba(255, 122, 168, 0.9)', priority: 78 },
  scan: { text: 'scan', color: '#13d8ff', bar: 'rgba(19, 216, 255, 0.82)', priority: 60 },
  candidate: { text: 'candidate', color: '#c0ff4f', bar: 'rgba(192, 255, 79, 0.9)', priority: 74 },
  heap: { text: 'heap', color: '#6bc1ff', bar: 'rgba(107, 193, 255, 0.9)', priority: 62 },
  root: { text: 'root', color: '#f5e61a', bar: 'rgba(245, 230, 26, 0.9)', priority: 88 },
  child: { text: 'child', color: '#a28bff', bar: 'rgba(162, 139, 255, 0.88)', priority: 76 },
  hole: { text: 'hole', color: '#ff9248', bar: 'rgba(255, 146, 72, 0.9)', priority: 75 },
  digit: { text: 'digit', color: '#00e5b0', bar: 'rgba(0, 229, 176, 0.9)', priority: 68 },
  bucket: { text: 'bucket', color: '#14f0c8', bar: 'rgba(20, 240, 200, 0.9)', priority: 68 },
};

const GENERIC_MARK_LABELS = new Set(['mark', 'swap', 'compare']);

const refs = {
  algoTitle: document.getElementById('algoTitle'),
  algoDescription: document.getElementById('algoDescription'),
  timeComplexity: document.getElementById('timeComplexity'),
  spaceComplexity: document.getElementById('spaceComplexity'),
  traceMode: document.getElementById('traceMode'),
  statusText: document.getElementById('statusText'),
  opsMeta: document.getElementById('opsMeta'),
  traceInfo: document.getElementById('traceInfo'),
  presetSelect: document.getElementById('presetSelect'),
  loadPresetBtn: document.getElementById('loadPresetBtn'),
  arrayInput: document.getElementById('arrayInput'),
  sizeInput: document.getElementById('sizeInput'),
  sizeValue: document.getElementById('sizeValue'),
  randomizeBtn: document.getElementById('randomizeBtn'),
  entryInput: document.getElementById('entryInput'),
  speedInput: document.getElementById('speedInput'),
  speedValue: document.getElementById('speedValue'),
  volumeInput: document.getElementById('volumeInput'),
  volumeValue: document.getElementById('volumeValue'),
  soundToggle: document.getElementById('soundToggle'),
  readFlashToggle: document.getElementById('readFlashToggle'),
  roleReadout: document.getElementById('roleReadout'),
  traceBtn: document.getElementById('traceBtn'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  stepBtn: document.getElementById('stepBtn'),
  resetBtn: document.getElementById('resetBtn'),
  errorBox: document.getElementById('errorBox'),
  codeInput: document.getElementById('codeInput'),
  lineNumbers: document.getElementById('lineNumbers'),
  canvas: document.getElementById('sortCanvas'),
};

const state = {
  selectedPreset: 'quickSort',
  baseArray: [],
  displayArray: [],
  ops: [],
  pointer: 0,
  playing: false,
  opAccumulator: 0,
  highlights: new Map(),
  roleMarks: new Map(),
  rangeMarks: [],
  worker: null,
  workerTimeoutId: null,
  activeRequestId: 0,
  tracing: false,
  traceMetrics: null,
  showReadFlashes: false,
  roleReadoutSignature: '',
  canvasSize: { width: 0, height: 0, dpr: 1 },
  lastFrameTs: performance.now(),
};

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.24;
    this.lastWriteAt = 0;
    this.lastReadAt = 0;
    this.lastMarkerAt = 0;
  }

  async prime() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  setVolume(percent) {
    const normalized = clamp(Number(percent) / 100, 0, 1);
    this.volume = normalized;
    if (this.master) {
      this.master.gain.setTargetAtTime(normalized, this.ctx.currentTime, 0.01);
    }
  }

  ping({ value, maxValue, kind, label }) {
    if (!this.enabled || !this.ctx || !this.master) return;

    const now = performance.now();
    const minGap = kind === 'write' ? 10 : kind === 'marker' ? 38 : 28;
    if (kind === 'write') {
      if (now - this.lastWriteAt < minGap) return;
      this.lastWriteAt = now;
    } else if (kind === 'marker') {
      if (now - this.lastMarkerAt < minGap) return;
      this.lastMarkerAt = now;
    } else {
      if (now - this.lastReadAt < minGap) return;
      this.lastReadAt = now;
    }

    const v = Number.isFinite(value) ? value : 0;
    const max = Math.max(1, Number.isFinite(maxValue) ? maxValue : 1);
    const ratio = clamp(v / max, 0, 1);
    const freq = 170 + ratio * 980;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const duration = kind === 'write' ? 0.045 : kind === 'marker' ? 0.03 : 0.02;

    osc.type = kind === 'write' ? 'triangle' : kind === 'marker' ? 'square' : 'sine';
    const markerBoost =
      kind === 'marker'
        ? label === 'pivot' || label === 'split'
          ? 170
          : label === 'i' || label === 'j'
            ? 110
            : 70
        : 0;
    osc.frequency.setValueAtTime(freq + markerBoost, t);
    gain.gain.setValueAtTime(kind === 'write' ? 0.15 : kind === 'marker' ? 0.04 : 0.045, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
  }
}

const sound = new SoundEngine();

init();
requestAnimationFrame(frameLoop);

function init() {
  populatePresetSelect();
  loadPreset(state.selectedPreset);
  bindEvents();
  updateSliderLabels();
  updateLineNumbers();
  resizeCanvasIfNeeded();
  setStatus('Idle');
  setTraceMeta('No trace yet');
  updateControlState();
}

function populatePresetSelect() {
  refs.presetSelect.innerHTML = '';
  for (const [key, preset] of Object.entries(EXAMPLES)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = preset.name;
    refs.presetSelect.append(option);
  }
  refs.presetSelect.value = state.selectedPreset;
}

function previewPreset(key) {
  const preset = EXAMPLES[key];
  if (!preset) return;
  refs.algoTitle.textContent = preset.name;
  refs.algoDescription.textContent = preset.description;
  refs.timeComplexity.textContent = preset.time;
  refs.spaceComplexity.textContent = preset.space;
  refs.traceMode.textContent = preset.mode || 'Worker + Proxy + Role Markers';
}

function loadPreset(key) {
  const preset = EXAMPLES[key];
  if (!preset) return;

  state.selectedPreset = key;
  refs.presetSelect.value = key;
  previewPreset(key);
  refs.codeInput.value = preset.code;
  refs.entryInput.value = preset.entryCall;
  refs.sizeInput.value = String(preset.defaultSize);
  updateSliderLabels();
  setRandomArray(preset.defaultSize, preset);
  updateLineNumbers();
  clearTrace({ keepArray: true });
  setTraceInfo(
    'Preset loaded. Pointer/pivot labels render when the algorithm emits markers (built-ins do this). Custom code can call helpers.mark(index, "pivot") and helpers.range(start, end, "partition").'
  );
}

function bindEvents() {
  refs.loadPresetBtn.addEventListener('click', () => {
    loadPreset(refs.presetSelect.value);
  });

  refs.presetSelect.addEventListener('change', () => {
    previewPreset(refs.presetSelect.value);
  });

  refs.randomizeBtn.addEventListener('click', () => {
    setRandomArray(Number(refs.sizeInput.value), getCurrentPreset());
    clearTrace({ keepArray: true });
    setTraceInfo('Random array generated. Trace again to animate the new values.');
  });

  refs.sizeInput.addEventListener('input', updateSliderLabels);
  refs.speedInput.addEventListener('input', updateSliderLabels);
  refs.volumeInput.addEventListener('input', () => {
    updateSliderLabels();
    sound.setVolume(Number(refs.volumeInput.value));
  });
  refs.soundToggle.addEventListener('change', () => {
    sound.setEnabled(refs.soundToggle.checked);
  });
  refs.readFlashToggle?.addEventListener('change', () => {
    state.showReadFlashes = !!refs.readFlashToggle.checked;
  });

  refs.traceBtn.addEventListener('click', async () => {
    await sound.prime();
    await traceAndPlay({ autoplay: true });
  });

  refs.playPauseBtn.addEventListener('click', async () => {
    if (!state.ops.length) {
      await sound.prime();
      await traceAndPlay({ autoplay: true });
      return;
    }

    await sound.prime();
    state.playing = !state.playing;
    if (state.playing && state.pointer >= state.ops.length) {
      resetPlayback();
      state.playing = true;
    }
    setStatus(state.playing ? 'Playing' : 'Paused');
    updateControlState();
  });

  refs.stepBtn.addEventListener('click', async () => {
    if (!state.ops.length) {
      await sound.prime();
      await traceAndPlay({ autoplay: false });
      return;
    }
    if (state.pointer >= state.ops.length) {
      resetPlayback();
    }
    state.playing = false;
    applySteps(1);
    setStatus(state.pointer >= state.ops.length ? 'Complete' : 'Stepping');
    updateControlState();
  });

  refs.resetBtn.addEventListener('click', () => {
    resetPlayback();
    setStatus('Reset');
    updateControlState();
  });

  refs.codeInput.addEventListener('input', () => {
    updateLineNumbers();
    clearError();
    clearTrace({ keepArray: true });
  });

  refs.codeInput.addEventListener('scroll', syncEditorScroll);
  refs.arrayInput.addEventListener('input', () => {
    clearError();
    clearTrace({ keepArray: true });
  });
  refs.entryInput.addEventListener('input', () => {
    clearError();
    clearTrace({ keepArray: true });
  });

  window.addEventListener('keydown', async (event) => {
    const isTraceShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Enter';
    if (!isTraceShortcut) return;
    event.preventDefault();
    await sound.prime();
    await traceAndPlay({ autoplay: true });
  });

  window.addEventListener('resize', resizeCanvasIfNeeded);
  window.addEventListener('beforeunload', () => cleanupWorker());
  window.addEventListener('pointerdown', () => {
    void sound.prime();
  });

  sound.setEnabled(refs.soundToggle.checked);
  sound.setVolume(Number(refs.volumeInput.value));
  state.showReadFlashes = !!refs.readFlashToggle?.checked;
  updateRoleReadout();
}

function updateSliderLabels() {
  refs.sizeValue.textContent = `${refs.sizeInput.value}`;
  refs.speedValue.textContent = `${getPlaybackOpsPerSecond()} ops/s`;
  refs.volumeValue.textContent = `${refs.volumeInput.value}%`;
}

function updateLineNumbers() {
  const lines = refs.codeInput.value.split('\n').length;
  let text = '';
  for (let i = 1; i <= lines; i += 1) {
    text += `${i}${i === lines ? '' : '\n'}`;
  }
  refs.lineNumbers.textContent = text || '1';
  syncEditorScroll();
}

function syncEditorScroll() {
  refs.lineNumbers.scrollTop = refs.codeInput.scrollTop;
}

function setRandomArray(size, preset = getCurrentPreset()) {
  const n = clamp(Math.floor(Number(size) || 32), 2, 180);
  let array;

  if (preset?.uniqueValues) {
    array = Array.from({ length: n }, (_, i) => i + 1);
    shuffleInPlace(array);
    array = array.map((value) => 8 + value * 3 + Math.floor(Math.random() * 3));
  } else if (preset?.smallIntegerValues) {
    array = Array.from({ length: n }, () => Math.floor(Math.random() * 99));
  } else {
    array = Array.from({ length: n }, (_, i) => {
      const base = 12 + Math.floor(((i + 1) / n) * 88);
      const jitter = Math.floor(Math.random() * 32);
      return base + jitter;
    });
    shuffleInPlace(array);
  }

  refs.arrayInput.value = array.join(', ');
  state.baseArray = array.slice();
  state.displayArray = array.slice();
  state.highlights.clear();
  state.roleMarks.clear();
  state.rangeMarks = [];
}

function parseArrayInput() {
  const raw = refs.arrayInput.value.trim();
  if (!raw) {
    throw new Error('Array input is empty. Add numbers like 4, 2, 9, 1');
  }

  let parsed;
  if (raw.startsWith('[')) {
    parsed = JSON.parse(raw);
  } else {
    parsed = raw
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Array input must parse to an array.');
  }

  const numbers = parsed.map((value, index) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`Array value at index ${index} is not a finite number.`);
    }
    return n;
  });

  if (numbers.length < 2) throw new Error('Use at least 2 values.');
  if (numbers.length > 256) throw new Error('Use at most 256 values for tracing.');

  return numbers;
}

async function traceAndPlay({ autoplay }) {
  clearError();

  let inputArray;
  try {
    inputArray = parseArrayInput();
  } catch (error) {
    showError(error);
    setStatus('Input error');
    return;
  }

  const code = refs.codeInput.value;
  const entryCall = refs.entryInput.value.trim();
  if (!code.trim()) {
    showError('Code editor is empty. Paste a sorting function first.');
    setStatus('Input error');
    return;
  }

  cleanupWorker();
  state.playing = false;
  state.tracing = true;
  state.ops = [];
  state.pointer = 0;
  state.opAccumulator = 0;
  state.highlights.clear();
  state.roleMarks.clear();
  state.rangeMarks = [];
  state.baseArray = inputArray.slice();
  state.displayArray = inputArray.slice();
  setStatus('Tracing...');
  setTraceMeta('Running your code in a worker');
  setTraceInfo('Capturing array reads/writes plus helper markers. Built-in presets emit pivot/current/i/j and partition ranges.');
  updateControlState();

  const requestId = ++state.activeRequestId;
  const worker = new Worker('./worker.js');
  state.worker = worker;
  const preset = getCurrentPreset();
  const factor = Number.isFinite(preset?.maxOpsFactor) ? preset.maxOpsFactor : 24;
  const maxOps = Math.min(300000, Math.max(20000, Math.floor(inputArray.length * inputArray.length * factor)));

  const result = await new Promise((resolve) => {
    const timeoutMs = inputArray.length > 90 ? 12000 : 8000;
    state.workerTimeoutId = window.setTimeout(() => {
      if (state.worker === worker) {
        worker.terminate();
        state.worker = null;
      }
      resolve({
        ok: false,
        error: `Trace timed out after ${timeoutMs / 1000}s. Try a smaller array, faster algorithm, or reduce helper marks.`,
      });
    }, timeoutMs);

    worker.onmessage = (event) => {
      const data = event.data || {};
      if (data.requestId !== requestId) return;
      resolve(data.type === 'result' ? { ok: true, data } : { ok: false, error: data.error || 'Worker error' });
    };

    worker.onerror = (event) => {
      resolve({ ok: false, error: event.message || 'Worker crashed' });
    };

    worker.postMessage({
      type: 'trace',
      requestId,
      code,
      entryCall,
      array: inputArray,
      maxOps,
    });
  });

  if (state.workerTimeoutId) {
    window.clearTimeout(state.workerTimeoutId);
    state.workerTimeoutId = null;
  }
  if (state.worker === worker) {
    worker.terminate();
    state.worker = null;
  }
  state.tracing = false;

  if (!result.ok) {
    showError(result.error);
    setStatus('Trace failed');
    updateControlState();
    return;
  }

  const payload = result.data;
  state.ops = Array.isArray(payload.ops) ? payload.ops : [];
  state.pointer = 0;
  state.opAccumulator = 0;
  state.highlights.clear();
  state.roleMarks.clear();
  state.rangeMarks = [];
  state.baseArray = Array.isArray(payload.inputArray) ? payload.inputArray.slice() : inputArray.slice();
  state.displayArray = state.baseArray.slice();
  state.traceMetrics = payload.metrics || null;
  if (payload.entryCall) {
    refs.entryInput.value = payload.entryCall;
  }

  const opCountText = state.traceMetrics?.operationCount?.toLocaleString?.() || state.ops.length.toLocaleString();
  const durationText = `${Math.max(0, Math.round(state.traceMetrics?.durationMs || 0))}ms`;
  setTraceMeta(`${opCountText} ops • traced in ${durationText}`);
  setTraceInfo(
    state.ops.length
      ? 'Trace ready. Yellow = pivot/important roles, cyan = current scans, pink = writes. Built-ins also show i/j pointers and partition windows.'
      : 'Trace completed but recorded 0 array operations. This visualizer expects in-place array reads/writes on arr[index].'
  );
  setStatus('Trace ready');

  if (autoplay && state.ops.length) {
    state.playing = true;
    setStatus('Playing');
  }

  updateControlState();
}

function clearTrace({ keepArray }) {
  state.ops = [];
  state.pointer = 0;
  state.playing = false;
  state.opAccumulator = 0;
  state.traceMetrics = null;
  state.highlights.clear();
  state.roleMarks.clear();
  state.rangeMarks = [];
  if (!keepArray) {
    state.baseArray = [];
    state.displayArray = [];
  } else if (state.baseArray.length) {
    state.displayArray = state.baseArray.slice();
  }
  cleanupWorker();
  updateControlState();
  setTraceMeta('No trace yet');
  if (!state.tracing) setStatus('Idle');
}

function resetPlayback() {
  state.playing = false;
  state.pointer = 0;
  state.opAccumulator = 0;
  state.highlights.clear();
  state.roleMarks.clear();
  state.rangeMarks = [];
  if (state.baseArray.length) {
    state.displayArray = state.baseArray.slice();
  }
  updateControlState();
}

function applySteps(stepCount) {
  let remaining = Math.max(0, Math.floor(stepCount));
  while (remaining > 0 && state.pointer < state.ops.length) {
    const op = state.ops[state.pointer];
    applyOperation(op);
    state.pointer += 1;
    remaining -= 1;
  }

  if (state.pointer >= state.ops.length && state.ops.length > 0) {
    state.playing = false;
    setStatus(isNonDecreasing(state.displayArray) ? 'Complete' : 'Playback ended');
  }

  updateControlState();
}

function applyOperation(op) {
  if (!op || typeof op !== 'object') return;

  switch (op.type) {
    case 'read': {
      const index = Number(op.index);
      if (state.showReadFlashes) {
        markIndex(index, 'read', 0.12);
      }
      const value = state.displayArray[index];
      sound.ping({ value, maxValue: getMaxArrayValue(state.displayArray), kind: 'read' });
      break;
    }
    case 'write': {
      const index = Number(op.index);
      if (index >= 0 && index < state.displayArray.length) {
        const nextValue = Number(op.value);
        if (Number.isFinite(nextValue)) {
          state.displayArray[index] = nextValue;
        }
      }
      markIndex(index, 'write', 0.34);
      sound.ping({ value: state.displayArray[index], maxValue: getMaxArrayValue(state.displayArray), kind: 'write' });
      break;
    }
    case 'mark': {
      const label = normalizeRoleLabel(op.label);
      const indices = Array.isArray(op.indices) ? op.indices : [];
      for (const idx of indices) {
        const index = Number(idx);
        const trackedRole = shouldTrackRoleLabel(label);
        const flashKind = label === 'swap' ? 'write' : trackedRole ? 'role' : state.showReadFlashes ? 'read' : null;
        if (flashKind) {
          markIndex(index, flashKind, flashKind === 'write' ? 0.26 : flashKind === 'role' ? 0.3 : 0.14);
        }
        if (trackedRole) {
          setRoleMark(label, index, roleTtlForLabel(label));
          sound.ping({
            value: state.displayArray[index],
            maxValue: getMaxArrayValue(state.displayArray),
            kind: 'marker',
            label,
          });
        }
      }
      break;
    }
    case 'range': {
      setRangeMark(Number(op.start), Number(op.end), String(op.label || 'range'), 0.55);
      break;
    }
    case 'compare':
    default:
      break;
  }
}

function markIndex(index, kind, ttl) {
  if (!Number.isInteger(index) || index < 0 || index >= state.displayArray.length) return;
  const existing = state.highlights.get(index);
  if (existing) {
    existing.kind = prioritizeFlashKind(existing.kind, kind);
    existing.ttl = Math.max(existing.ttl, ttl);
    return;
  }
  state.highlights.set(index, { kind, ttl });
}

function prioritizeFlashKind(a, b) {
  const rank = { write: 4, role: 3, read: 2 };
  return (rank[b] || 0) >= (rank[a] || 0) ? b : a;
}

function setRoleMark(label, index, ttl) {
  if (!Number.isInteger(index) || index < 0 || index >= state.displayArray.length) return;
  const key = label;
  const style = getRoleStyle(label);
  state.roleMarks.set(key, {
    label,
    index,
    ttl,
    color: style.color,
    priority: style.priority,
  });
  updateRoleReadout();
}

function roleTtlForLabel(label) {
  switch (label) {
    case 'pivot':
    case 'split':
      return 0.8;
    case 'i':
    case 'j':
      return 0.45;
    case 'current':
    case 'scan':
      return 0.22;
    default:
      return 0.35;
  }
}

function setRangeMark(start, end, label, ttl) {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  if (hi < 0 || lo >= state.displayArray.length) return;
  state.rangeMarks.unshift({
    start: clamp(lo, 0, state.displayArray.length - 1),
    end: clamp(hi, 0, state.displayArray.length - 1),
    label: String(label || 'range'),
    ttl,
  });
  if (state.rangeMarks.length > 8) {
    state.rangeMarks.length = 8;
  }
}

function frameLoop(timestamp) {
  const dt = Math.min(0.05, (timestamp - state.lastFrameTs) / 1000 || 0);
  state.lastFrameTs = timestamp;

  if (state.playing && state.ops.length) {
    const opsPerSecond = getPlaybackOpsPerSecond();
    state.opAccumulator += dt * opsPerSecond;
    const batch = Math.min(4000, Math.floor(state.opAccumulator));
    if (batch > 0) {
      state.opAccumulator -= batch;
      applySteps(batch);
    }
  }

  decayVisualMarkers(dt);
  updateRoleReadout();
  drawCanvas();
  requestAnimationFrame(frameLoop);
}

function decayVisualMarkers(dt) {
  for (const [index, highlight] of state.highlights.entries()) {
    highlight.ttl -= dt;
    if (highlight.ttl <= 0) state.highlights.delete(index);
  }

  for (const [label, marker] of state.roleMarks.entries()) {
    marker.ttl -= dt;
    if (marker.ttl <= 0) state.roleMarks.delete(label);
  }

  if (state.rangeMarks.length) {
    for (const mark of state.rangeMarks) {
      mark.ttl -= dt;
    }
    state.rangeMarks = state.rangeMarks.filter((mark) => mark.ttl > 0);
  }
}

function drawCanvas() {
  resizeCanvasIfNeeded();
  const canvas = refs.canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height, dpr } = state.canvasSize;
  if (!width || !height) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawCanvasBackground(ctx, width, height);

  const array = state.displayArray;
  if (!array.length) {
    drawEmptyCanvas(ctx, width, height);
    return;
  }

  const rolesByIndex = getRolesByIndex();
  const layout = computeBarLayout(array, width, height);
  drawRangeOverlays(ctx, layout, width, height);

  const done = state.ops.length > 0 && state.pointer >= state.ops.length && isNonDecreasing(array);
  for (let i = 0; i < array.length; i += 1) {
    const bar = layout.bars[i];
    if (!bar) continue;
    const hl = state.highlights.get(i);
    const roleList = rolesByIndex.get(i) || [];
    const primaryRole = roleList[0];

    let fill = 'rgba(201, 204, 212, 0.9)';
    if (done) {
      fill = 'rgba(59, 240, 127, 0.95)';
    } else if (hl?.kind === 'write') {
      fill = `rgba(255, 75, 120, ${0.72 + clamp(hl.ttl / 0.34, 0, 1) * 0.28})`;
    } else if (hl?.kind === 'read') {
      fill = `rgba(19, 216, 255, ${0.62 + clamp(hl.ttl / 0.18, 0, 1) * 0.3})`;
    } else if (hl?.kind === 'role') {
      fill = primaryRole?.style?.bar || 'rgba(245, 230, 26, 0.92)';
    } else if (primaryRole) {
      fill = primaryRole.style.bar;
    }

    roundedRect(ctx, bar.x, bar.y, bar.w, bar.h, bar.radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  drawRoleCallouts(ctx, layout, rolesByIndex);
  drawHudOverlay(ctx, width, height);
}

function drawEmptyCanvas(ctx, width, height) {
  ctx.fillStyle = 'rgba(232, 238, 248, 0.72)';
  ctx.font = '600 16px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('No array loaded', width / 2, height / 2 - 6);
  ctx.fillStyle = 'rgba(154, 164, 180, 0.9)';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText('Paste values or generate a random set', width / 2, height / 2 + 18);
}

function computeBarLayout(array, width, height) {
  const minVal = Math.min(...array);
  const maxVal = Math.max(...array);
  const spread = maxVal - minVal || 1;
  const n = array.length;
  const padX = 12;
  const padTop = 20;
  const padBottom = 18;
  const plotW = Math.max(1, width - padX * 2);
  const plotH = Math.max(1, height - padTop - padBottom);
  const gap = n > 80 ? 1 : 2;
  const barW = Math.max(1, (plotW - gap * (n - 1)) / n);

  const bars = array.map((value, index) => {
    const normalized = clamp((value - minVal) / spread, 0, 1);
    const h = Math.max(4, normalized * plotH);
    const x = padX + index * (barW + gap);
    const y = height - padBottom - h;
    return {
      x,
      y,
      w: barW,
      h,
      cx: x + barW / 2,
      radius: Math.min(6, barW * 0.35),
    };
  });

  return { bars, padX, padTop, padBottom, plotW, plotH, barW, gap, width, height };
}

function drawRangeOverlays(ctx, layout) {
  if (!state.rangeMarks.length || !layout.bars.length) return;
  const colorByLabel = {
    partition: 'rgba(245, 230, 26, 0.08)',
    'left-part': 'rgba(19, 216, 255, 0.08)',
    'right-part': 'rgba(255, 75, 120, 0.08)',
    merge: 'rgba(19, 216, 255, 0.08)',
    heap: 'rgba(140, 125, 255, 0.08)',
    default: 'rgba(255, 255, 255, 0.05)',
  };

  for (let i = state.rangeMarks.length - 1; i >= 0; i -= 1) {
    const range = state.rangeMarks[i];
    const leftBar = layout.bars[range.start];
    const rightBar = layout.bars[range.end];
    if (!leftBar || !rightBar) continue;
    const x = leftBar.x - 1;
    const w = rightBar.x + rightBar.w - leftBar.x + 2;
    const alphaBoost = clamp(range.ttl / 0.55, 0, 1) * 0.08;
    const key = String(range.label || '').toLowerCase();
    const base = colorByLabel[key] || colorByLabel.default;
    ctx.fillStyle = base.replace(/0\.08\)/, `${(0.05 + alphaBoost).toFixed(3)})`);
    ctx.fillRect(x, 0, w, layout.height);
  }
}

function getRolesByIndex() {
  const map = new Map();
  for (const marker of state.roleMarks.values()) {
    if (marker.ttl <= 0) continue;
    const list = map.get(marker.index) || [];
    list.push({ ...marker, style: getRoleStyle(marker.label) });
    map.set(marker.index, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => b.style.priority - a.style.priority || String(a.label).localeCompare(String(b.label)));
  }
  return map;
}

function drawRoleCallouts(ctx, layout, rolesByIndex) {
  if (!rolesByIndex.size) return;
  const all = [];
  for (const [index, roles] of rolesByIndex.entries()) {
    const bar = layout.bars[index];
    if (!bar) continue;
    all.push({ index, bar, roles: roles.slice(0, 2) });
  }

  all.sort((a, b) => a.bar.cx - b.bar.cx);
  const maxLabels = layout.bars.length > 80 ? 4 : 10;
  let rendered = 0;
  const lanes = [];

  for (const item of all) {
    if (rendered >= maxLabels) break;
    for (const role of item.roles.filter((entry) => entry.style.priority >= 80).slice(0, 1)) {
      if (rendered >= maxLabels) break;
      const text = getRoleStyle(role.label).text;
      const paddingX = 6;
      const tagH = 16;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      const textW = ctx.measureText(text).width;
      const tagW = textW + paddingX * 2;
      let x = clamp(item.bar.cx - tagW / 2, 6, layout.width - tagW - 6);

      let lane = 0;
      while (lane < lanes.length && Math.abs(lanes[lane] - x) < tagW + 6) {
        lane += 1;
      }
      lanes[lane] = x;

      const baseY = Math.max(34, item.bar.y - 10 - lane * 20);
      const lineY = Math.min(item.bar.y - 1, layout.height - layout.padBottom - item.bar.h);

      if (role.label === 'pivot') {
        drawPivotArrowCallout(ctx, item.bar.cx, lineY, x, baseY, tagW, tagH, text, role.color);
        rendered += 1;
        continue;
      }

      ctx.strokeStyle = `${role.color}aa`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(item.bar.cx, lineY);
      ctx.lineTo(item.bar.cx, baseY + tagH);
      ctx.stroke();

      roundedRect(ctx, x, baseY, tagW, tagH, 6);
      ctx.fillStyle = role.color;
      ctx.fill();
      ctx.fillStyle = 'rgba(5, 7, 11, 0.96)';
      ctx.textAlign = 'left';
      ctx.fillText(text, x + paddingX, baseY + 12);
      rendered += 1;
    }
  }
}

function drawPivotArrowCallout(ctx, barX, barTopY, tagX, tagY, tagW, tagH, text, color) {
  const shaftBottomY = Math.max(14, barTopY - 3);
  const shaftTopY = tagY + tagH;

  ctx.strokeStyle = `${color}dd`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(barX, shaftTopY);
  ctx.lineTo(barX, shaftBottomY);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(barX, barTopY - 1);
  ctx.lineTo(barX - 5, shaftBottomY - 1);
  ctx.lineTo(barX + 5, shaftBottomY - 1);
  ctx.closePath();
  ctx.fill();

  roundedRect(ctx, tagX, tagY, tagW, tagH, 6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(5, 7, 11, 0.96)';
  ctx.textAlign = 'left';
  ctx.fillText(text, tagX + 6, tagY + 12);
}

function drawCanvasBackground(ctx, width, height) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, 'rgba(8, 10, 15, 0.96)');
  bg.addColorStop(1, 'rgba(4, 5, 8, 0.98)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const gridX = 34;
  const gridY = 28;
  for (let x = 0.5; x < width; x += gridX) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0.5; y < height; y += gridY) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawHudOverlay(ctx, width, height) {
  const stepText = state.ops.length
    ? `Step ${state.pointer.toLocaleString()} / ${state.ops.length.toLocaleString()}`
    : 'Step 0 / 0';
  const arrayText = state.displayArray.length
    ? `${state.displayArray.length} bars • ${isNonDecreasing(state.displayArray) && state.pointer >= state.ops.length && state.ops.length ? 'sorted' : 'tracing playback'}`
    : 'No array';
  const roleSummary = formatRoleSummary();
  const hudH = roleSummary ? 60 : 44;

  ctx.fillStyle = 'rgba(5, 7, 11, 0.72)';
  roundedRect(ctx, 10, 10, Math.min(width - 20, 330), hudH, 10);
  ctx.fill();

  ctx.fillStyle = 'rgba(232, 238, 248, 0.96)';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(stepText, 18, 29);
  ctx.fillStyle = 'rgba(154, 164, 180, 0.95)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(arrayText, 18, 46);

  if (roleSummary) {
    ctx.fillStyle = 'rgba(245, 230, 26, 0.92)';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(roleSummary, 18, 60);
  }
}

function formatRoleSummary() {
  if (!state.roleMarks.size) return '';
  const interesting = Array.from(state.roleMarks.values())
    .filter((marker) => marker.ttl > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  if (!interesting.length) return '';
  return interesting
    .map((marker) => `${getRoleStyle(marker.label).text}:${marker.index}`)
    .join('  ');
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function resizeCanvasIfNeeded() {
  const rect = refs.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = window.devicePixelRatio || 1;

  if (width === state.canvasSize.width && height === state.canvasSize.height && dpr === state.canvasSize.dpr) {
    return;
  }

  state.canvasSize = { width, height, dpr };
  refs.canvas.width = Math.round(width * dpr);
  refs.canvas.height = Math.round(height * dpr);
}

function cleanupWorker() {
  if (state.worker) {
    state.worker.terminate();
    state.worker = null;
  }
  if (state.workerTimeoutId) {
    window.clearTimeout(state.workerTimeoutId);
    state.workerTimeoutId = null;
  }
  state.tracing = false;
}

function setStatus(text) {
  refs.statusText.textContent = text;
}

function setTraceMeta(text) {
  refs.opsMeta.textContent = text;
}

function setTraceInfo(text) {
  refs.traceInfo.textContent = text;
}

function showError(error) {
  refs.errorBox.textContent = typeof error === 'string' ? error : error?.message || String(error);
  refs.errorBox.classList.remove('is-hidden');
}

function clearError() {
  refs.errorBox.textContent = '';
  refs.errorBox.classList.add('is-hidden');
}

function updateControlState() {
  refs.playPauseBtn.textContent = state.playing ? 'Pause' : 'Play';
  refs.playPauseBtn.disabled = state.tracing;
  refs.traceBtn.disabled = state.tracing;
  refs.stepBtn.disabled = state.tracing;
  refs.resetBtn.disabled = state.tracing || (!state.ops.length && !state.baseArray.length);
}

function getPlaybackOpsPerSecond() {
  const slider = clamp(Number(refs.speedInput?.value ?? 0), 0, 100);
  const t = slider / 100;
  return Math.max(1, Math.round(1 + Math.pow(t, 4) * 2399));
}

function updateRoleReadout() {
  if (!refs.roleReadout) return;
  const markers = Array.from(state.roleMarks.values())
    .filter((marker) => marker.ttl > 0)
    .sort((a, b) => b.priority - a.priority || String(a.label).localeCompare(String(b.label)))
    .slice(0, 8);

  const signature = markers
    .map((marker) => `${marker.label}:${marker.index}:${Math.round(marker.ttl * 10)}`)
    .join('|');

  if (!markers.length && state.roleReadoutSignature === '__empty__') {
    return;
  }
  if (markers.length && signature === state.roleReadoutSignature) {
    return;
  }

  refs.roleReadout.innerHTML = '';
  if (!markers.length) {
    state.roleReadoutSignature = '__empty__';
    refs.roleReadout.classList.add('is-empty');
    refs.roleReadout.textContent = 'Pointer readout: waiting for pivot/current/i/j markers...';
    return;
  }

  state.roleReadoutSignature = signature;
  refs.roleReadout.classList.remove('is-empty');
  for (const marker of markers) {
    const style = getRoleStyle(marker.label);
    const chip = document.createElement('span');
    chip.className = 'role-chip';
    chip.style.borderColor = `${style.color}44`;
    chip.style.boxShadow = `inset 0 0 0 1px ${style.color}22`;

    const labelEl = document.createElement('span');
    labelEl.className = 'role-chip-label';
    labelEl.style.color = style.color;
    labelEl.textContent = style.text;

    const metaEl = document.createElement('span');
    metaEl.className = 'role-chip-meta';
    const value = state.displayArray[marker.index];
    metaEl.textContent = `#${marker.index}${Number.isFinite(value) ? ` = ${value}` : ''}`;

    chip.append(labelEl, metaEl);
    refs.roleReadout.append(chip);
  }
}

function getCurrentPreset() {
  return EXAMPLES[state.selectedPreset] || null;
}

function normalizeRoleLabel(label) {
  return String(label || '').trim().toLowerCase();
}

function shouldTrackRoleLabel(label) {
  const normalized = normalizeRoleLabel(label);
  return !!normalized && !GENERIC_MARK_LABELS.has(normalized);
}

function getRoleStyle(label) {
  const normalized = normalizeRoleLabel(label);
  if (ROLE_STYLES[normalized]) return ROLE_STYLES[normalized];
  return {
    text: normalized || 'mark',
    color: '#d7dee8',
    bar: 'rgba(215, 222, 232, 0.88)',
    priority: 40,
  };
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isNonDecreasing(array) {
  for (let i = 1; i < array.length; i += 1) {
    if (array[i] < array[i - 1]) return false;
  }
  return true;
}

function getMaxArrayValue(array) {
  if (!array.length) return 1;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of array) {
    if (Number.isFinite(value) && value > max) max = value;
  }
  return Number.isFinite(max) ? max : 1;
}

function buildExamples() {
  return {
    quickSort: {
      name: 'Quick Sort (Hoare, pointer visual)',
      description:
        'Two-pointer partition visual: pivot is highlighted, i and j move toward each other, then recursion splits around the partition index.',
      time: 'O(n log n) avg',
      space: 'O(log n)',
      mode: 'Worker + Proxy + Pivot/i/j markers',
      entryCall: 'quickSort(arr, 0, arr.length - 1)',
      defaultSize: 28,
      maxOpsFactor: 40,
      uniqueValues: true,
      code: `function quickSort(arr, low, high) {
  if (low >= high) return;

  helpers.range(low, high, 'partition');
  helpers.mark(low, 'low');
  helpers.mark(high, 'high');

  const split = partition(arr, low, high);
  helpers.mark(split, 'split');
  if (split >= low) helpers.range(low, split, 'left-part');
  if (split + 1 <= high) helpers.range(split + 1, high, 'right-part');

  quickSort(arr, low, split);
  quickSort(arr, split + 1, high);
}

function partition(arr, low, high) {
  const pivotIndex = Math.floor((low + high) / 2);
  const pivot = arr[pivotIndex];
  let i = low - 1;
  let j = high + 1;

  helpers.mark(pivotIndex, 'pivot');

  while (true) {
    do {
      i++;
      helpers.mark(i, 'i');
      helpers.mark(i, 'current');
      helpers.mark(low, 'low');
      helpers.mark(high, 'high');
      helpers.mark(pivotIndex, 'pivot');
    } while (arr[i] < pivot);

    do {
      j--;
      helpers.mark(j, 'j');
      helpers.mark(j, 'current');
      helpers.mark(low, 'low');
      helpers.mark(high, 'high');
      helpers.mark(pivotIndex, 'pivot');
    } while (arr[j] > pivot);

    if (i >= j) {
      helpers.mark(j, 'split');
      return j;
    }

    helpers.mark(i, 'i');
    helpers.mark(j, 'j');
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}`,
    },
    quickSortLomuto: {
      name: 'Quick Sort (Lomuto)',
      description: 'Single scan pointer j walks the partition and stores smaller values with i while tracking the pivot at high.',
      time: 'O(n log n) avg',
      space: 'O(log n)',
      entryCall: 'quickSort(arr, 0, arr.length - 1)',
      defaultSize: 30,
      maxOpsFactor: 34,
      uniqueValues: true,
      code: `function quickSort(arr, low, high) {
  if (low < high) {
    helpers.range(low, high, 'partition');
    const pi = partition(arr, low, high);
    helpers.mark(pi, 'pivot');
    quickSort(arr, low, pi - 1);
    quickSort(arr, pi + 1, high);
  }
}

function partition(arr, low, high) {
  const pivot = arr[high];
  let i = low - 1;
  helpers.mark(high, 'pivot');
  helpers.mark(low, 'low');
  helpers.mark(high, 'high');

  for (let j = low; j < high; j++) {
    helpers.mark(j, 'j');
    helpers.mark(j, 'current');
    helpers.mark(i, 'i');
    helpers.mark(high, 'pivot');
    if (arr[j] < pivot) {
      i++;
      helpers.mark(i, 'i');
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}`,
    },
    mergeSort: {
      name: 'Merge Sort',
      description: 'Recursively splits into ranges, then merges sorted halves back with left/right pointers and a write pointer.',
      time: 'O(n log n)',
      space: 'O(n)',
      entryCall: 'mergeSort(arr, 0, arr.length - 1)',
      defaultSize: 34,
      maxOpsFactor: 36,
      uniqueValues: true,
      code: `function mergeSort(arr, left, right) {
  if (left >= right) return;
  const mid = Math.floor((left + right) / 2);
  helpers.range(left, right, 'merge');
  helpers.mark(left, 'left');
  helpers.mark(mid, 'mid');
  helpers.mark(right, 'right');

  mergeSort(arr, left, mid);
  mergeSort(arr, mid + 1, right);
  merge(arr, left, mid, right);
}

function merge(arr, left, mid, right) {
  const leftPart = arr.slice(left, mid + 1);
  const rightPart = arr.slice(mid + 1, right + 1);
  let i = 0;
  let j = 0;
  let k = left;

  while (i < leftPart.length && j < rightPart.length) {
    helpers.mark(left + i, 'left');
    helpers.mark(mid + 1 + j, 'right');
    helpers.mark(k, 'current');
    if (leftPart[i] <= rightPart[j]) {
      arr[k] = leftPart[i];
      i++;
    } else {
      arr[k] = rightPart[j];
      j++;
    }
    k++;
  }

  while (i < leftPart.length) {
    helpers.mark(left + i, 'left');
    helpers.mark(k, 'current');
    arr[k++] = leftPart[i++];
  }

  while (j < rightPart.length) {
    helpers.mark(mid + 1 + j, 'right');
    helpers.mark(k, 'current');
    arr[k++] = rightPart[j++];
  }
}`,
    },
    heapSort: {
      name: 'Heap Sort',
      description: 'Builds a max-heap, then repeatedly swaps root with end and heapifies the reduced heap.',
      time: 'O(n log n)',
      space: 'O(1)',
      entryCall: 'heapSort(arr)',
      defaultSize: 34,
      maxOpsFactor: 30,
      uniqueValues: true,
      code: `function heapSort(arr) {
  const n = arr.length;

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    helpers.range(0, n - 1, 'heap');
    heapify(arr, n, i);
  }

  for (let end = n - 1; end > 0; end--) {
    helpers.mark(0, 'root');
    helpers.mark(end, 'high');
    [arr[0], arr[end]] = [arr[end], arr[0]];
    helpers.range(0, end - 1, 'heap');
    heapify(arr, end, 0);
  }
}

function heapify(arr, heapSize, root) {
  let largest = root;
  const left = 2 * root + 1;
  const right = 2 * root + 2;

  helpers.mark(root, 'root');
  if (left < heapSize) helpers.mark(left, 'child');
  if (right < heapSize) helpers.mark(right, 'child');

  if (left < heapSize && arr[left] > arr[largest]) largest = left;
  if (right < heapSize && arr[right] > arr[largest]) largest = right;

  if (largest !== root) {
    helpers.mark(largest, 'max');
    [arr[root], arr[largest]] = [arr[largest], arr[root]];
    heapify(arr, heapSize, largest);
  }
}`,
    },
    insertionSort: {
      name: 'Insertion Sort',
      description: 'Builds a sorted prefix one value at a time using a key and shifting larger elements right.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'insertionSort(arr)',
      defaultSize: 26,
      maxOpsFactor: 30,
      uniqueValues: true,
      code: `function insertionSort(arr) {
  for (let i = 1; i < arr.length; i++) {
    let key = arr[i];
    let j = i - 1;
    helpers.mark(i, 'key');
    helpers.mark(i, 'current');

    while (j >= 0 && arr[j] > key) {
      helpers.mark(j, 'j');
      helpers.mark(j, 'current');
      arr[j + 1] = arr[j];
      j--;
    }

    arr[j + 1] = key;
    helpers.mark(j + 1, 'key');
  }
}`,
    },
    selectionSort: {
      name: 'Selection Sort',
      description: 'Scans for the minimum in the unsorted suffix, then swaps it into the next sorted position.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'selectionSort(arr)',
      defaultSize: 26,
      maxOpsFactor: 30,
      uniqueValues: true,
      code: `function selectionSort(arr) {
  for (let i = 0; i < arr.length - 1; i++) {
    let minIndex = i;
    helpers.mark(i, 'i');
    helpers.mark(minIndex, 'min');

    for (let j = i + 1; j < arr.length; j++) {
      helpers.mark(j, 'j');
      helpers.mark(j, 'current');
      helpers.mark(minIndex, 'min');
      if (arr[j] < arr[minIndex]) {
        minIndex = j;
        helpers.mark(minIndex, 'min');
      }
    }

    if (minIndex !== i) {
      [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
    }
  }
}`,
    },
    bubbleSort: {
      name: 'Bubble Sort',
      description: 'Adjacent comparisons bubble the largest value to the end on each pass.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'bubbleSort(arr)',
      defaultSize: 24,
      maxOpsFactor: 28,
      uniqueValues: true,
      code: `function bubbleSort(arr) {
  for (let i = 0; i < arr.length - 1; i++) {
    let swapped = false;
    helpers.mark(arr.length - 1 - i, 'high');
    for (let j = 0; j < arr.length - i - 1; j++) {
      helpers.mark(j, 'j');
      helpers.mark(j + 1, 'current');
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
}`,
    },
    shellSort: {
      name: 'Shell Sort',
      description: 'Runs gapped insertion sorts with decreasing gaps until the array is fully sorted.',
      time: '~O(n log² n)',
      space: 'O(1)',
      entryCall: 'shellSort(arr)',
      defaultSize: 32,
      maxOpsFactor: 28,
      uniqueValues: true,
      code: `function shellSort(arr) {
  for (let gap = Math.floor(arr.length / 2); gap > 0; gap = Math.floor(gap / 2)) {
    for (let i = gap; i < arr.length; i++) {
      const temp = arr[i];
      let j = i;
      helpers.mark(i, 'current');
      while (j >= gap && arr[j - gap] > temp) {
        helpers.mark(j - gap, 'left');
        helpers.mark(j, 'right');
        arr[j] = arr[j - gap];
        j -= gap;
      }
      arr[j] = temp;
      helpers.mark(j, 'hole');
    }
  }
}`,
    },
    cocktailSort: {
      name: 'Cocktail Shaker Sort',
      description: 'Bidirectional bubble passes move large values right and small values left in the same round.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'cocktailSort(arr)',
      defaultSize: 24,
      maxOpsFactor: 30,
      uniqueValues: true,
      code: `function cocktailSort(arr) {
  let start = 0;
  let end = arr.length - 1;
  let swapped = true;

  while (swapped) {
    swapped = false;
    helpers.mark(start, 'low');
    helpers.mark(end, 'high');

    for (let i = start; i < end; i++) {
      helpers.mark(i, 'current');
      helpers.mark(i + 1, 'scan');
      if (arr[i] > arr[i + 1]) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        swapped = true;
      }
    }

    if (!swapped) break;
    swapped = false;
    end--;

    for (let i = end; i > start; i--) {
      helpers.mark(i, 'current');
      helpers.mark(i - 1, 'scan');
      if (arr[i] < arr[i - 1]) {
        [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
        swapped = true;
      }
    }
    start++;
  }
}`,
    },
    combSort: {
      name: 'Comb Sort',
      description: 'Compares elements at a shrinking gap to eliminate turtles faster than bubble sort.',
      time: 'O(n²) worst',
      space: 'O(1)',
      entryCall: 'combSort(arr)',
      defaultSize: 28,
      maxOpsFactor: 28,
      uniqueValues: true,
      code: `function combSort(arr) {
  let gap = arr.length;
  let swapped = true;
  const shrink = 1.3;

  while (gap > 1 || swapped) {
    gap = Math.floor(gap / shrink);
    if (gap < 1) gap = 1;
    swapped = false;

    for (let i = 0; i + gap < arr.length; i++) {
      const j = i + gap;
      helpers.mark(i, 'i');
      helpers.mark(j, 'j');
      helpers.mark(j, 'current');
      if (arr[i] > arr[j]) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        swapped = true;
      }
    }
  }
}`,
    },
    gnomeSort: {
      name: 'Gnome Sort',
      description: 'Walks forward while ordered, steps backward on inversions like a garden gnome fixing pots.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'gnomeSort(arr)',
      defaultSize: 24,
      maxOpsFactor: 30,
      uniqueValues: true,
      code: `function gnomeSort(arr) {
  let i = 1;
  while (i < arr.length) {
    helpers.mark(i, 'i');
    helpers.mark(i - 1, 'j');
    if (i === 0 || arr[i] >= arr[i - 1]) {
      i++;
    } else {
      [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
      i--;
    }
  }
}`,
    },
    oddEvenSort: {
      name: 'Odd-Even Sort',
      description: 'Alternates odd and even indexed compare-swap passes until no swaps are needed.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'oddEvenSort(arr)',
      defaultSize: 24,
      maxOpsFactor: 28,
      uniqueValues: true,
      code: `function oddEvenSort(arr) {
  let sorted = false;
  while (!sorted) {
    sorted = true;
    for (let phase = 1; phase >= 0; phase--) {
      for (let i = phase; i < arr.length - 1; i += 2) {
        helpers.mark(i, 'i');
        helpers.mark(i + 1, 'j');
        if (arr[i] > arr[i + 1]) {
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
          sorted = false;
        }
      }
    }
  }
}`,
    },
    cycleSort: {
      name: 'Cycle Sort',
      description: 'Places each item directly into its final position to minimize writes.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'cycleSort(arr)',
      defaultSize: 18,
      maxOpsFactor: 36,
      uniqueValues: true,
      code: `function cycleSort(arr) {
  for (let cycleStart = 0; cycleStart < arr.length - 1; cycleStart++) {
    let item = arr[cycleStart];
    let pos = cycleStart;
    helpers.mark(cycleStart, 'current');

    for (let i = cycleStart + 1; i < arr.length; i++) {
      helpers.mark(i, 'scan');
      if (arr[i] < item) pos++;
    }

    if (pos === cycleStart) continue;
    while (item === arr[pos]) pos++;
    [arr[pos], item] = [item, arr[pos]];
    helpers.mark(pos, 'hole');

    while (pos !== cycleStart) {
      pos = cycleStart;
      for (let i = cycleStart + 1; i < arr.length; i++) {
        helpers.mark(i, 'scan');
        if (arr[i] < item) pos++;
      }
      while (item === arr[pos]) pos++;
      [arr[pos], item] = [item, arr[pos]];
      helpers.mark(pos, 'hole');
    }
  }
}`,
    },
    countingSort: {
      name: 'Counting Sort (non-negative ints)',
      description: 'Counts occurrences, then rewrites the array in sorted order using frequency buckets.',
      time: 'O(n + k)',
      space: 'O(k)',
      entryCall: 'countingSort(arr)',
      defaultSize: 34,
      maxOpsFactor: 24,
      smallIntegerValues: true,
      code: `function countingSort(arr) {
  if (!arr.length) return;
  const max = Math.max(...arr);
  const count = new Array(max + 1).fill(0);

  for (let i = 0; i < arr.length; i++) {
    helpers.mark(i, 'current');
    count[arr[i]]++;
  }

  let write = 0;
  for (let value = 0; value < count.length; value++) {
    while (count[value] > 0) {
      helpers.mark(write, 'current');
      helpers.mark(write, 'digit');
      arr[write++] = value;
      count[value]--;
    }
  }
}`,
    },
    radixSort: {
      name: 'Radix Sort (LSD, non-negative ints)',
      description: 'Sorts digits from least significant to most significant using stable counting passes.',
      time: 'O(d(n + b))',
      space: 'O(n + b)',
      entryCall: 'radixSort(arr)',
      defaultSize: 32,
      maxOpsFactor: 34,
      smallIntegerValues: true,
      code: `function radixSort(arr) {
  const max = Math.max(...arr);
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    countingByDigit(arr, exp);
  }
}

function countingByDigit(arr, exp) {
  const output = new Array(arr.length).fill(0);
  const count = new Array(10).fill(0);

  for (let i = 0; i < arr.length; i++) {
    helpers.mark(i, 'current');
    const digit = Math.floor(arr[i] / exp) % 10;
    count[digit]++;
  }

  for (let i = 1; i < 10; i++) count[i] += count[i - 1];

  for (let i = arr.length - 1; i >= 0; i--) {
    helpers.mark(i, 'digit');
    const digit = Math.floor(arr[i] / exp) % 10;
    output[count[digit] - 1] = arr[i];
    count[digit]--;
  }

  for (let i = 0; i < arr.length; i++) {
    helpers.mark(i, 'current');
    arr[i] = output[i];
  }
}`,
    },
    pancakeSort: {
      name: 'Pancake Sort',
      description: 'Uses prefix reversals (flips) to bring the current maximum to its final position.',
      time: 'O(n²)',
      space: 'O(1)',
      entryCall: 'pancakeSort(arr)',
      defaultSize: 18,
      maxOpsFactor: 34,
      uniqueValues: true,
      code: `function pancakeSort(arr) {
  for (let size = arr.length; size > 1; size--) {
    let maxIndex = 0;
    for (let i = 1; i < size; i++) {
      helpers.mark(i, 'scan');
      if (arr[i] > arr[maxIndex]) maxIndex = i;
    }
    helpers.mark(maxIndex, 'max');
    if (maxIndex === size - 1) continue;
    flip(arr, maxIndex);
    flip(arr, size - 1);
  }
}

function flip(arr, end) {
  let i = 0;
  let j = end;
  while (i < j) {
    helpers.mark(i, 'i');
    helpers.mark(j, 'j');
    [arr[i], arr[j]] = [arr[j], arr[i]];
    i++;
    j--;
  }
}`,
    },
    stoogeSort: {
      name: 'Stooge Sort (for chaos)',
      description: 'Recursively sorts overlapping sections. Terrible in practice, useful for visual contrast.',
      time: 'O(n^2.71)',
      space: 'O(n)',
      entryCall: 'stoogeSort(arr, 0, arr.length - 1)',
      defaultSize: 8,
      maxOpsFactor: 80,
      uniqueValues: true,
      code: `function stoogeSort(arr, i, j) {
  helpers.range(i, j, 'partition');
  helpers.mark(i, 'low');
  helpers.mark(j, 'high');
  if (arr[i] > arr[j]) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  if (j - i + 1 > 2) {
    const t = Math.floor((j - i + 1) / 3);
    stoogeSort(arr, i, j - t);
    stoogeSort(arr, i + t, j);
    stoogeSort(arr, i, j - t);
  }
}`,
    },
    bogoSort: {
      name: 'Bogo Sort (yes, really)',
      description: 'Randomly shuffles until sorted. Included for fun; keep arrays tiny.',
      time: 'O((n+1)!) expected',
      space: 'O(1)',
      entryCall: 'bogoSort(arr)',
      defaultSize: 5,
      maxOpsFactor: 140,
      uniqueValues: true,
      code: `function bogoSort(arr) {
  let attempts = 0;
  while (!isSorted(arr)) {
    attempts++;
    if (attempts > 2000) {
      throw new Error('Bogo Sort gave up after 2000 shuffles. Use fewer items.');
    }
    shuffle(arr);
  }
}

function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    helpers.mark(i - 1, 'current');
    helpers.mark(i, 'current');
    if (arr[i - 1] > arr[i]) return false;
  }
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    helpers.mark(i, 'i');
    helpers.mark(j, 'j');
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}`,
    },
  };
}
