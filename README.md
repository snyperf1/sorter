# Sort Visual Lab

Interactive sorting visualizer for JavaScript algorithms.

## Features

- Paste sorting code (for example Quick Sort, Insertion Sort, Bubble Sort)
- Run it against a custom array
- Proxy-based trace capture in a Web Worker
- Animated bar playback with sound FX
- Mobile-friendly UI

## How It Works

The app runs your code in a browser Web Worker and instruments `arr[index]` reads/writes using a `Proxy`. Those operations are recorded, then replayed in the canvas visualizer.

Best results come from in-place sorting code that mutates `arr`.

## Local Run

```bash
python3 -m http.server 4173
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).
