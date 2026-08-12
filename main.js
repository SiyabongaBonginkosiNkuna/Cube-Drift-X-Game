
// ── WebGL context 
const canvas = document.getElementById("glCanvas");
const gl     = canvas.getContext("webgl");
if (!gl) alert("WebGL not supported");

// Resize canvas to fill the window and rebuild the projection matrix
function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    // perspective(fov, aspect, near, far) – from utils.js
    proj = perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 100);
}
window.addEventListener("resize", resize);


// ── GLSL SHADERS ────────────────────────────────────────────────


const VS = `
  attribute vec3 aPosition;  /* vertex position (local space)   */
  attribute vec3 aNormal;    /* surface normal  (local space)   */
  attribute vec2 aTexCoord;  /* UV coordinate   (for texture)   */

  uniform mat4 uModel;       /* moves/rotates/scales the object */
  uniform mat4 uProjection;  /* maps 3D world to 2D screen      */

  varying vec3 vNormal;      /* passed to fragment shader       */
  varying vec2 vTexCoord;

  void main() {
    vNormal     = normalize(mat3(uModel) * aNormal);
    vTexCoord   = aTexCoord;
    gl_Position = uProjection * uModel * vec4(aPosition, 1.0);
  }
`;

const FS = `
  precision mediump float;

  uniform vec4      uColor;    /* RGBA colour tint                */
  uniform sampler2D uTexture;  /* checkerboard texture            */

  varying vec3 vNormal;
  varying vec2 vTexCoord;

  void main() {
    vec3  light    = normalize(vec3(0.5, 1.0, 0.3));   /* light direction */
    float diff     = max(dot(normalize(vNormal), light), 0.0);
    float lighting = 0.3 + diff * 0.7;                 /* ambient + diffuse */

    vec4 tex      = texture2D(uTexture, vTexCoord);
    gl_FragColor  = vec4(uColor.rgb * tex.rgb * lighting, uColor.a);
  }
`;

const program = createProgram(gl, VS, FS);  // createProgram is in utils.js
gl.useProgram(program);
gl.enable(gl.DEPTH_TEST);  // closer faces hide farther ones


// ── GEOMETRY 

const STRIDE = 8 * 4;  // bytes between consecutive vertices
const H      = 0.5;    // half-size of the unit cube

// Build interleaved vertex data for one face (4 vertices, 32 floats)
function makeFace(ax,ay,az, bx,by,bz, cx,cy,cz, dx,dy,dz,
                  nx,ny,nz, u0,v0, u1,v1) {
    return [
        ax,ay,az, nx,ny,nz, u0,v0,
        bx,by,bz, nx,ny,nz, u1,v0,
        cx,cy,cz, nx,ny,nz, u1,v1,
        dx,dy,dz, nx,ny,nz, u0,v1,
    ];
}

// Six faces of the cube
const cubeVerts = [
    /* Front  */ ...makeFace(-H,-H, H,  H,-H, H,  H, H, H, -H, H, H,  0, 0, 1,  0,0,1,1),
    /* Back   */ ...makeFace( H,-H,-H, -H,-H,-H, -H, H,-H,  H, H,-H,  0, 0,-1,  0,0,1,1),
    /* Top    */ ...makeFace(-H, H, H,  H, H, H,  H, H,-H, -H, H,-H,  0, 1, 0,  0,0,1,1),
    /* Bottom */ ...makeFace(-H,-H,-H,  H,-H,-H,  H,-H, H, -H,-H, H,  0,-1, 0,  0,0,1,1),
    /* Right  */ ...makeFace( H,-H, H,  H,-H,-H,  H, H,-H,  H, H, H,  1, 0, 0,  0,0,1,1),
    /* Left   */ ...makeFace(-H,-H,-H, -H,-H, H, -H, H, H, -H, H,-H, -1, 0, 0,  0,0,1,1),
];

// Indices: 2 triangles per face → (b,b+1,b+2) and (b,b+2,b+3)
const cubeIdx = [];
for (let f = 0; f < 6; f++) {
    const b = f * 4;
    cubeIdx.push(b,b+1,b+2,  b,b+2,b+3);
}

// Upload cube data to GPU
const cubeVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,         cubeVBO);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVerts), gl.STATIC_DRAW);

const cubeIBO = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIBO);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIdx), gl.STATIC_DRAW);

// Ground – a flat quad, also index-buffered
const groundVerts = [
    -5, 0,-40,  0,1,0,  0,  40,
     5, 0,-40,  0,1,0,  5,  40,
     5, 0,  2,  0,1,0,  5,   0,
    -5, 0,  2,  0,1,0,  0,   0,
];
const groundIdx = [0,1,2,  0,2,3];

const groundVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,         groundVBO);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(groundVerts), gl.STATIC_DRAW);

const groundIBO = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, groundIBO);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(groundIdx), gl.STATIC_DRAW);


// ── ATTRIBUTE + UNIFORM LOCATIONS ───────────────────────────────
// These integer handles let JS talk to the GLSL shader variables.
const aPosition   = gl.getAttribLocation(program, "aPosition");
const aNormal     = gl.getAttribLocation(program, "aNormal");
const aTexCoord   = gl.getAttribLocation(program, "aTexCoord");
const uModel      = gl.getUniformLocation(program, "uModel");
const uProjection = gl.getUniformLocation(program, "uProjection");
const uColor      = gl.getUniformLocation(program, "uColor");
const uTexLoc     = gl.getUniformLocation(program, "uTexture");
gl.uniform1i(uTexLoc, 0);  // always use texture unit 0


// ── TEXTURES ─────────────────────────────────────────────────────
// createCheckerTexture is defined in utils.js
const playerTex   = createCheckerTexture(gl, 32,  [0,160,100,255],  [0,255,160,255]);
const obstacleTex = createCheckerTexture(gl, 32,  [160,15,15,255],  [255,55,55,255]);
const groundTex   = createCheckerTexture(gl, 128, [35,35,50,255],   [55,55,75,255]);


// ── GAME STATE ───────────────────────────────────────────────────
// These are your ORIGINAL variables, unchanged.
let proj;               // perspective matrix (set by resize())
let playerX   = 0;      // player's X position  (range: -2 to +2)
let obstacles = [];     // array of { x, y, stuck } objects
let speed     = 0.02;   // how far obstacles fall per frame
let score     = 0;      // +1 every frame while alive
let highScore = 0;      // best score this session
let gameOver  = true;   // true on start screen and after collision
let collided  = false;  // true once player hits an obstacle
let stuckCube = null;   // the obstacle welded to the player on impact
let spinAngle = 0;      // increases each frame to spin the cubes

const overlay = document.getElementById("overlay");


// ── INPUT ────────────────────────────────────────────────────────
// YOUR ORIGINAL keydown logic – nothing changed here.
window.addEventListener("keydown", (e) => {

    // ENTER → reset everything and start playing
    if (e.key === "Enter") {
        gameOver  = false;
        collided  = false;
        stuckCube = null;
        playerX   = 0;
        obstacles = [];
        score     = 0;
        speed     = 0.02;
    }

    // Arrow keys move the player left or right by 0.25 units
    if (!gameOver) {
        if (e.key === "ArrowLeft")  playerX -= 0.25;
        if (e.key === "ArrowRight") playerX += 0.25;
        playerX = Math.max(-2, Math.min(2, playerX));  // clamp to screen
    }
});


// ── HELPERS ──────────────────────────────────────────────────────

// Point the cube buffers at the shader attributes
function bindCube() {
    gl.bindBuffer(gl.ARRAY_BUFFER,         cubeVBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIBO);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, STRIDE, 0);   // offset 0
    gl.vertexAttribPointer(aNormal,   3, gl.FLOAT, false, STRIDE, 12);  // offset 12
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, STRIDE, 24);  // offset 24
    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aNormal);
    gl.enableVertexAttribArray(aTexCoord);
}

// Point the ground buffers at the shader attributes
function bindGround() {
    gl.bindBuffer(gl.ARRAY_BUFFER,         groundVBO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, groundIBO);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(aNormal,   3, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, STRIDE, 24);
    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aNormal);
    gl.enableVertexAttribArray(aTexCoord);
}

// Draw a cube: upload model matrix, colour, texture, then call drawElements
function drawCube(modelMat, r, g, b, a, tex) {
    bindCube();
    gl.uniformMatrix4fv(uModel, false, modelMat);
    gl.uniform4f(uColor, r, g, b, a);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

// Rewrite the overlay div for the current game state
function updateOverlay() {
    if (!gameOver) {
        overlay.innerHTML = `
          <div class="hud-score">SCORE &nbsp;<span class="val">${score}</span></div>
          <div class="hud-best" >BEST  &nbsp;&nbsp;<span class="val">${highScore}</span></div>`;
        return;
    }
    if (collided) {
        overlay.innerHTML = `
          <div class="gameover">GAME OVER</div>
          <div class="score-line">Score &nbsp;<span class="val">${score}</span></div>
          <div class="score-line">Best  &nbsp;&nbsp;<span class="val">${highScore}</span></div>
          <div class="sub">Press <kbd>ENTER</kbd> to Retry</div>`;
    } else {
        overlay.innerHTML = `
          <div class="title">CUBE DRIFT X</div>
          <div class="sub">Press <kbd>ENTER</kbd> to Start</div>
          <div class="controls">Use ← → Arrow Keys to dodge</div>`;
    }
}

// Update the CSS speed bar based on the current speed value
function updateSpeedBar() {
    const pct = Math.min(((speed - 0.02) / 0.08) * 100, 100);
    document.getElementById("spd-fill").style.width = Math.max(5, pct) + "%";
}


// ── MAIN GAME LOOP ───────────────────────────────────────────────

function draw() {

    // 1. Clear to dark background each frame
    gl.clearColor(0.03, 0.03, 0.08, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uProjection, false, proj);

    // 2. Game-over / start screen: show spinning idle cube
    if (gameOver) {
        spinAngle += 0.01;
        bindGround();
        gl.uniformMatrix4fv(uModel, false, translate(0, -1.5, -3));
        gl.uniform4f(uColor, 1,1,1,1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, groundTex);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        drawCube(
            chainMat(translate(0,-1.2,-3), rotateY(spinAngle), rotateX(spinAngle*0.4), scale(0.24,0.24,0.24)),
            0, 1, 0.4, 1, playerTex
        );
        updateOverlay();
        updateSpeedBar();
        requestAnimationFrame(draw);
        return;
    }

    // 3. UPDATE STATE (your original logic)
    score++;
    if (score > highScore) highScore = score;
    speed     += 0.00001;    // game gets faster every frame
    spinAngle += 0.02;       // cubes spin a little more each frame

    // Spawn a new obstacle ~3% of frames
    if (Math.random() < 0.03) {
        obstacles.push({ x: Math.random() * 4 - 2, y: 2, stuck: false });
    }

    // 4a. Draw ground
    bindGround();
    gl.uniformMatrix4fv(uModel, false, translate(0, -1.5, -3));
    gl.uniform4f(uColor, 1,1,1,1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, groundTex);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // 4b. Draw player
    // Model = translate to position × slow Y spin × scale to game size
    drawCube(
        chainMat(translate(playerX,-1.2,-3), rotateY(spinAngle*0.5), scale(0.24,0.24,0.24)),
        0, 1, 0.4, 1, playerTex
    );

    // 4c. Update and draw each obstacle
    for (const o of obstacles) {

        // Move the obstacle downward (only while player is alive)
        if (!collided) o.y -= speed;

        // ── COLLISION CHECK (your original box test) ──
        if (!collided &&
            Math.abs(o.x - playerX) < 0.25 &&   // same horizontal position?
            Math.abs(o.y + 1.2)     < 0.25)      // same vertical position?
        {
            collided  = true;
            gameOver  = true;
            stuckCube = o;
            o.x = playerX;   // glue the cube to the player
            o.y = -1.2;
            o.stuck = true;
        }

        // Model = translate × tumble (rotateX + rotateY) × scale
        const model = chainMat(
            translate(o.x, o.y, -3),
            rotateX(spinAngle),
            rotateY(spinAngle * 0.7),
            scale(0.24, 0.24, 0.24)
        );

        // Stuck cube flashes white; moving obstacles are red
        drawCube(model, o.stuck ? 1 : 1, o.stuck ? 1 : 0, o.stuck ? 1 : 0, 1, obstacleTex);
    }

    // 5. Remove obstacles that have scrolled off the bottom
    obstacles = obstacles.filter(o => o.y > -2);

    // 6. Refresh HUD and speed bar
    updateOverlay();
    updateSpeedBar();

    requestAnimationFrame(draw);
}


// ── BOOTSTRAP ────────────────────────────────────────────────────
resize();         // set canvas size + build projection matrix
updateOverlay();  // show start screen
requestAnimationFrame(draw);
