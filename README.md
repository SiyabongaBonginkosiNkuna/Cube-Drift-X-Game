# Cube Runner 3D

## What is it?
An endless-runner game built with raw WebGL .
You control a green cube and dodge red obstacles that fall toward you.
The longer you survive, the higher your score — and the faster the obstacles fall.

# How to play
| Key | Action |
|---|---|
| `←` Arrow | Move left |
| `→` Arrow | Move right |
| `ENTER` | Start / Restart |

---

## How it works

### The three files
| File | Role |
|---|---|
| `index.html` | Canvas, CSS styling, UI elements (overlay, speed bar, corner brackets) |
| `utils.js` | Shader compiler, matrix library (translate/rotate/scale), texture generator |
| `main.js` | Game logic, geometry, render loop |

---

### Rendering pipeline (how a cube appears on screen)
```
CPU (JavaScript)                GPU (GLSL Shaders)
────────────────                ──────────────────
1. Build Model Matrix           3. Vertex shader runs per vertex:
   translate × rotateY             clip pos = Projection × Model × position
   × scale                         normal rotated into world space

2. Upload matrix + colour       4. Fragment shader runs per pixel:
   to GPU uniforms                  diffuse lighting from normal
                                    sample checkerboard texture
                                    multiply by colour tint
```

### Key OpenGL concepts used
- **Perspective matrix** — `perspective(fov, aspect, near, far)` creates the depth illusion
- **Model matrix** — `chainMat(translate, rotateX/Y, scale)` positions each cube in the world
- **Vertex normals** — stored per-vertex in the interleaved buffer, used for diffuse lighting
- **Index buffer (IBO)** — 24 vertices + 36 indices per cube instead of 36 repeated vertices
- **Textures** — procedural checkerboard generated on CPU, uploaded with mipmapping
- **Depth test** — `gl.DEPTH_TEST` ensures closer faces hide farther ones

### Game loop (every frame ~60×/sec)
```
clear screen
│
├─ game over? → draw idle spinning cube → show overlay → return
│
├─ score++  |  speed += 0.00001
│
├─ spawn obstacle (3% chance)
│
├─ draw ground
├─ draw player  (translate → rotateY → scale)
│
└─ for each obstacle:
      move down by speed
      collision check: |o.x − playerX| < 0.25 AND |o.y − (−1.2)| < 0.25
      if hit → stick cube to player, gameOver = true
      draw obstacle (translate → rotateX × rotateY → scale)
```

---

## How to run
Place all three files in the same folder, then either:
- Open `index.html` directly in Chrome/Firefox/Edge, **or**
- Run a local server: `python -m http.server 8080` → open `http://localhost:8080`
