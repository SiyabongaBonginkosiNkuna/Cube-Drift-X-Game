
// ── 1. SHADER HELPERS ───────────────────────────────────────────

/**
 * Compile one GLSL shader (vertex or fragment).
 * @param {WebGLRenderingContext} gl
 * @param {number} type    gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string} source  GLSL source code
 * @returns {WebGLShader|null}
 */
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader error:\n" + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

/**
 * Link a vertex + fragment shader into a usable GPU program.
 * @param {WebGLRenderingContext} gl
 * @param {string} vs  vertex shader source
 * @param {string} fs  fragment shader source
 * @returns {WebGLProgram|null}
 */
function createProgram(gl, vs, fs) {
    const v = createShader(gl, gl.VERTEX_SHADER,   vs);
    const f = createShader(gl, gl.FRAGMENT_SHADER, fs);

    const prog = gl.createProgram();
    gl.attachShader(prog, v);
    gl.attachShader(prog, f);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("Program error:\n" + gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}



/**
 * Perspective projection matrix.
 * Creates the "things farther away look smaller" effect.
 * @param {number} fov    
 * @param {number} aspect
 * @param {number} near   
 * @param {number} far    
 */
function perspective(fov, aspect, near, far) {
    const t = 1.0 / Math.tan(fov / 2);
    return new Float32Array([
        t / aspect, 0,  0,                              0,
        0,           t,  0,                              0,
        0,           0,  (far + near) / (near - far),   -1,
        0,           0,  (2 * far * near) / (near - far), 0
    ]);
}

/** Move an object to position (x, y, z) in the world. */
function translate(x, y, z) {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ]);
}

/** Resize an object by factors sx, sy, sz on each axis. */
function scale(sx, sy, sz) {
    return new Float32Array([
        sx, 0,  0,  0,
        0,  sy, 0,  0,
        0,  0,  sz, 0,
        0,  0,  0,  1
    ]);
}

/** Rotate around the X axis (tilt forward/backward). */
function rotateX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
        1,  0, 0, 0,
        0,  c, s, 0,
        0, -s, c, 0,
        0,  0, 0, 1
    ]);
}

/** Rotate around the Y axis (spin left/right). */
function rotateY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
         c, 0, -s, 0,
         0, 1,  0, 0,
         s, 0,  c, 0,
         0, 0,  0, 1
    ]);
}

/** Rotate around the Z axis (roll clockwise/counter-clockwise). */
function rotateZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
         c, s, 0, 0,
        -s, c, 0, 0,
         0, 0, 1, 0,
         0, 0, 0, 1
    ]);
}

/**
 * Multiply two 4×4 column-major matrices: returns A × B.
 * Use this to combine transforms (e.g. translate then rotate).
 */
function multiplyMat4(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++)
        for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let k = 0; k < 4; k++)
                sum += a[k * 4 + row] * b[col * 4 + k];
            out[col * 4 + row] = sum;
        }
    return out;
}

/**
 * Chain-multiply any number of matrices left-to-right.
 * Example: chainMat(translate(x,y,z), rotateY(a), scale(s,s,s))
 */
function chainMat(...mats) {
    return mats.reduce((acc, m) => multiplyMat4(acc, m));
}


// ── 3. TEXTURE HELPER ───────────────────────────────────────────

/**

 * @param {WebGLRenderingContext} gl
 * @param {number}   size  texture dimensions (use a power of 2)
 * @param {number[]} colA  RGBA for dark  squares e.g. [40,40,40,255]
 * @param {number[]} colB  RGBA for light squares e.g. [80,80,80,255]
 * @returns {WebGLTexture}
 */
function createCheckerTexture(gl, size, colA, colB) {
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i   = (y * size + x) * 4;
            // XOR of high bits of x and y produces the checker grid
            const col = ((x >> 3) ^ (y >> 3)) & 1 ? colB : colA;
            data[i]   = col[0];
            data[i+1] = col[1];
            data[i+2] = col[2];
            data[i+3] = col[3];
        }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                  size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);   // smooth at any distance
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
}
