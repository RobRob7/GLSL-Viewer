// File: main.js
// Date: 04/20/2025
// Purpose:
//    Handles all changes made to code editor; updates
//    rendering window


// initialize animationId at the top
let animationId = null;

// vertex shader source (fixed)
const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

// get all DOM elements
const editor = document.getElementById('editor');
const runBtn = document.getElementById('run-btn');
const resetBtn = document.getElementById('reset-btn');
const autoUpdateCheckbox = document.getElementById('auto-update');
const canvas = document.getElementById('canvas');
const errorDisplay = document.getElementById('error-display');

// create WebGL context
const gl = canvas.getContext('webgl');

// check for WebGL support
if (!gl) {
    // catch errors
    alert('WebGL not supported in your browser');
    throw new Error('WebGL not supported');
}

// create vertex shader
const vertexShader = gl.createShader(gl.VERTEX_SHADER);
// move source code into vertex shader
gl.shaderSource(vertexShader, vertexShaderSource);
// compile vertex shader
gl.compileShader(vertexShader);

// check for vertex shader compilation error
if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
}

// will contain shader program
let shaderProgram = null;

// will contain current fragment shader
let currentFragmentShader = null;

// fullscreen quad vertices (rendering object)
const vertices = new Float32Array([
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
     1.0,  1.0
]);

// VBO
const vertexBuffer = gl.createBuffer();
// bind vertex buffer
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
// attach vertex buffer data
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// compile shader and render
compileShader(editor.value);

// used for delta time (for 'time' uniform variable)
let startTime = Date.now();

// run button listener
runBtn.addEventListener('click', () => {
    // compile new shader and render
    compileShader(editor.value);
});

// reset button listener
resetBtn.addEventListener('click', () => {
  // get default shader contents, load
  fetch('../default/defaultGLSL.txt')
    .then(response => response.text())
    .then(data => {
      editor.value = data;
    })
    .catch(error => {
      editor.value = 'Error loading file: ' + error;
    });
    // compile shader and run
    compileShader(editor.value);
});

// code editor listener for input
editor.addEventListener('input', () => {
    // if auto-update checkbox is on
    if (autoUpdateCheckbox.checked) {
        // compile shader and render
        compileShader(editor.value);
    }
});

// listen for resize of window
window.addEventListener('resize', resizeCanvas);

////////////////////////////////////////////////////////////////////////////////

// function compileShader(...)
// compile shaders and start render process
// PRE:
//  - source: the GLSL source code
function compileShader(source) {
    // create fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    // move source code into fragment shader
    gl.shaderSource(fragmentShader, source);
    // compile fragment shader
    gl.compileShader(fragmentShader);

    // check for fragmet shader compilation error
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        // display error caught
        const error = gl.getShaderInfoLog(fragmentShader);
        showError(error);
        return;
    }

    // hide syntax error display
    hideError();

    // create new shader program
    const newShaderProgram = gl.createProgram();
    // attach vertex shader
    gl.attachShader(newShaderProgram, vertexShader);
    // attach fragment shader
    gl.attachShader(newShaderProgram, fragmentShader);
    // link shader program
    gl.linkProgram(newShaderProgram);

    // check for shader program link error
    if (!gl.getProgramParameter(newShaderProgram, gl.LINK_STATUS)) {
        // display error caught
        const error = gl.getProgramInfoLog(newShaderProgram);
        showError(error);
        return;
    }

    // clean up previous program if it exists
    if (shaderProgram) {
        gl.deleteProgram(shaderProgram);
    }

    // clean up previous fragment shader if it exists
    if (currentFragmentShader) {
        gl.deleteShader(currentFragmentShader);
    }

    // update current shader program
    shaderProgram = newShaderProgram;
    // update current fragment shader
    currentFragmentShader = fragmentShader;

    // start render
    render();
} // end of compileShader(...)


// function render()
// starts rendering process
function render() {
    // cancel any existing animation frame
    if (animationId) {
        cancelAnimationFrame(animationId);
    }

    // start new render loop
    function loop() {
        renderLoop();
        animationId = requestAnimationFrame(loop);
    }

    // get animation ID
    animationId = requestAnimationFrame(loop);
} // end of render()


// function renderLoop()
// will render quad with fragment shader
function renderLoop() {
    // only render if shader program has been sets
    if (!shaderProgram) return;

    // set viewport (rendering window settings)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // clear render background to white
    gl.clearColor(0, 0, 0, 1);
    // clear color buffer
    gl.clear(gl.COLOR_BUFFER_BIT);

    // use shader program
    gl.useProgram(shaderProgram);

    // get position attribute location
    const positionAttributeLocation = gl.getAttribLocation(shaderProgram, "position");
    // enable vertex attribute array
    gl.enableVertexAttribArray(positionAttributeLocation);
    // bind vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    // declare vertex buffer settings
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // get time uniform location
    const timeUniformLocation = gl.getUniformLocation(shaderProgram, "time");
    // get resolution uniform location
    const resolutionUniformLocation = gl.getUniformLocation(shaderProgram, "resolution");

    // get the current time
    const currentTime = (Date.now() - startTime) / 1000;

    // set time uniform
    gl.uniform1f(timeUniformLocation, currentTime);
    // set resolution uniform
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

    // draw quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
} // end of renderLoop()


// function resizeCanvas()
// will reconfigure the canvas size based on window size
function resizeCanvas() {
    // get canvas container
    const container = canvas.parentElement;
    // get width of window
    const width = container.clientWidth;
    // get heigth of window
    const height = container.clientHeight;

    // check for change in either width or height
    if (canvas.width !== width || canvas.height !== height) {
        // update width and height
        canvas.width = width;
        canvas.height = height;
    }
} // end of resizeCanvas()


// function showError(...)
// will render quad with fragment shader
// PRE:
//  - message: the error message
// POST:
//  - display error message
function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';
} // end of showError(...)


// function hideError()
// will hide error display
function hideError() {
    // set error display to none
    errorDisplay.style.display = 'none';
} // end of hideError()
