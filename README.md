# Sort Visual Lab

Interactive visualization lab for sorting and maze pathfinding algorithms.

## Features

- Paste sorting code (Quick Sort, Merge Sort, Heap Sort, Counting/Radix, Bogo Sort, and more presets)
- Run it against a custom array
- Proxy-based trace capture in a Web Worker
- Animated bar playback with sound FX
- Semantic sort markers (pivot, current, i, j, partition ranges) for built-in presets
- Separate maze pathfinding page with BFS / DFS / Dijkstra / A* and editable walls
- Mobile-friendly UI

## How It Works

The sorting page runs your code in a browser Web Worker and instruments `arr[index]` reads/writes using a `Proxy`. Those operations are recorded, then replayed in the canvas visualizer.

Built-in sorting presets also emit semantic markers using `helpers.mark()` / `helpers.range()` so the visualizer can show pivot and pointer movement.

The maze page is a separate visualizer (`maze.html`) with editable grids, maze generation, and pathfinding playback traces.

## Local Run

```bash
python3 -m http.server 4173
```

Open:

- [http://127.0.0.1:4173](http://127.0.0.1:4173) (sorting)
- [http://127.0.0.1:4173/maze.html](http://127.0.0.1:4173/maze.html) (maze pathfinding)
