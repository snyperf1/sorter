const DEFAULT_MAX_OPS = 120000;

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.type !== 'trace') {
    return;
  }

  const startedAt = Date.now();
  try {
    const requestId = data.requestId;
    const maxOps = clampMaxOps(data.maxOps);
    const inputArray = sanitizeArray(data.array);
    const sourceCode = String(data.code || '');
    const entryCall = String(data.entryCall || '').trim();

    if (!sourceCode.trim()) {
      throw new Error('No code provided.');
    }

    const ops = [];
    const liveArray = inputArray.slice();

    const pushOp = (op) => {
      if (ops.length >= maxOps) {
        throw new Error(`Operation limit exceeded (${maxOps.toLocaleString()}). Try a smaller array or simpler trace.`);
      }
      if (op.type === 'read') {
        const prev = ops[ops.length - 1];
        if (prev && prev.type === 'read' && prev.index === op.index) {
          return;
        }
      }
      ops.push(op);
    };

    const arrProxy = new Proxy(liveArray, {
      get(target, prop, receiver) {
        const index = toArrayIndex(prop);
        if (index !== null) {
          pushOp({ type: 'read', index });
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return value.bind(receiver);
        }
        return value;
      },
      set(target, prop, value, receiver) {
        const index = toArrayIndex(prop);
        const oldValue = index !== null ? target[index] : undefined;
        const ok = Reflect.set(target, prop, value, receiver);

        if (index !== null) {
          pushOp({
            type: 'write',
            index,
            value: toSerializableNumber(value),
            oldValue: toSerializableNumber(oldValue),
          });
        }
        return ok;
      },
    });

    const helpers = {
      swap(i, j) {
        const ia = Number(i);
        const ja = Number(j);
        pushOp({ type: 'mark', indices: [ia, ja], label: 'swap' });
        const temp = arrProxy[ia];
        arrProxy[ia] = arrProxy[ja];
        arrProxy[ja] = temp;
      },
      compare(a, b) {
        pushOp({ type: 'compare', left: toSerializableNumber(a), right: toSerializableNumber(b) });
        if (a === b) return 0;
        return a > b ? 1 : -1;
      },
      mark(indices, label = 'mark') {
        const list = Array.isArray(indices) ? indices.map(Number) : [Number(indices)];
        pushOp({ type: 'mark', indices: list, label: String(label) });
      },
      read(i) {
        return arrProxy[Number(i)];
      },
      write(i, value) {
        arrProxy[Number(i)] = value;
        return value;
      },
      emit(op) {
        if (op && typeof op === 'object') {
          pushOp(op);
        }
      },
    };

    const resolvedEntryCall = entryCall || inferEntryCall(sourceCode);
    if (!resolvedEntryCall) {
      throw new Error('Could not infer an entry call. Add an entry call like quickSort(arr, 0, arr.length - 1).');
    }

    const runner = new Function(
      'arr',
      'helpers',
      `"use strict";\n${sourceCode}\n;(() => { ${resolvedEntryCall}; })();\nreturn arr;`
    );

    runner(arrProxy, helpers);

    postMessage({
      type: 'result',
      requestId,
      ops,
      sortedArray: liveArray,
      inputArray,
      entryCall: resolvedEntryCall,
      metrics: {
        durationMs: Date.now() - startedAt,
        operationCount: ops.length,
      },
    });
  } catch (error) {
    postMessage({
      type: 'error',
      requestId: data.requestId,
      error: formatError(error),
      metrics: {
        durationMs: Date.now() - startedAt,
      },
    });
  }
};

function clampMaxOps(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_OPS;
  return Math.max(5000, Math.min(DEFAULT_MAX_OPS, Math.floor(n)));
}

function sanitizeArray(list) {
  if (!Array.isArray(list)) {
    throw new Error('Array input must be an array.');
  }

  const numbers = list.map((value, index) => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`Array value at index ${index} is not a finite number.`);
    }
    return n;
  });

  if (numbers.length < 2) {
    throw new Error('Use at least 2 numbers.');
  }
  if (numbers.length > 256) {
    throw new Error('Array is too large for tracing (max 256 items).');
  }
  return numbers;
}

function toArrayIndex(prop) {
  if (typeof prop === 'number') {
    return Number.isInteger(prop) && prop >= 0 ? prop : null;
  }
  if (typeof prop !== 'string') {
    return null;
  }
  if (!/^\d+$/.test(prop)) {
    return null;
  }
  const n = Number(prop);
  return Number.isSafeInteger(n) ? n : null;
}

function toSerializableNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function inferEntryCall(sourceCode) {
  const candidates = ['quickSort', 'mergeSort', 'heapSort', 'insertionSort', 'selectionSort', 'bubbleSort', 'sort'];
  for (const name of candidates) {
    const fnRegex = new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=\\s*\\()`, 'm');
    if (fnRegex.test(sourceCode)) {
      if (name === 'quickSort') return 'quickSort(arr, 0, arr.length - 1)';
      return `${name}(arr)`;
    }
  }
  return '';
}

function formatError(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  const stack = typeof error.stack === 'string' ? error.stack : '';
  const message = error.message ? String(error.message) : String(error);
  return stack || message;
}
