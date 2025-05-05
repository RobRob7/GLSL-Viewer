// File: main.js
// Date: 04/20/2025
// Purpose:
//    Handles all changes made to code editor; updates
//    rendering window


// initialize animationId at the top
let animationId = null;
let currentShaderId = null; // Track currently loaded shader
// Auth state
let authToken = localStorage.getItem('authToken') || null;
let currentUser = authToken ? jwtDecode(authToken).id : null;
const DEFAULT_SHADER_CODE = `// Default fragment shader
precision highp float;

uniform float time;
uniform vec2 resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 color = vec3(uv.x, uv.y, sin(time) * 0.5 + 0.5);
    gl_FragColor = vec4(color, 1.0);
}`;
async function init() {
    updateAuthUI();

    if (currentUser) {
        await loadUserShaders();
        // Load last viewed shader if available
        const lastShaderId = localStorage.getItem('lastShaderId');
        if (lastShaderId) {
            await loadShader(lastShaderId);
        } else if (shaderList.children.length > 0) {
            // Load first shader by default
            await loadShader(shaderList.children[0].dataset.id);
        }
    } else {
        // Load default shader for non-logged users
        editor.value = DEFAULT_SHADER_CODE;
        compileShader(DEFAULT_SHADER_CODE);
    }
}

// Call init when DOM loads
document.addEventListener('DOMContentLoaded', init);
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
    -1.0, 1.0,
    1.0, 1.0
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
resetBtn.addEventListener('click', async () => {
    // get default shader contents, load
    await fetch('shaders/defaultGLSL.txt')
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

    // update canvas size if needed
    resizeCanvas();

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

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authModalTitle = document.getElementById('auth-modal-title');
const closeModal = document.querySelector('.close');
const shaderListContainer = document.getElementById('shader-list-container');
const shaderList = document.getElementById('shader-list');
const newShaderBtn = document.getElementById('new-shader-btn');

document.getElementById('update-btn').addEventListener('click', updateShader);


// Updated update function
async function updateShader() {
    if (!currentShaderId) {
        showNotification('No shader Selected', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/shaders/${currentShaderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken // Include if using auth
            },
            body: JSON.stringify({
                code: editor.value
            })
        });

        if (!response.ok) showNotification('Failed to save shader', 'error');

        const updatedShader = await response.json();
        console.log('Shader updated:', updatedShader);
        showNotification('shader saved successfully!', 'success');
    } catch (err) {
        console.error('Error saving shader:', err);
        showNotification('Failed to save shader', 'error');
    }
}

// Event Listeners
loginBtn.addEventListener('click', () => {
    authModalTitle.textContent = 'Login';
    authModal.style.display = 'block';
    authForm.onsubmit = handleLogin;
});

registerBtn.addEventListener('click', () => {
    authModalTitle.textContent = 'Register';
    authModal.style.display = 'block';
    authForm.onsubmit = handleRegister;
});

logoutBtn.addEventListener('click', handleLogout);
closeModal.addEventListener('click', () => authModal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.style.display = 'none';
});

newShaderBtn.addEventListener('click', createNewShader);

// Auth Functions
// Modified auth handlers
async function handleLogin(e) {
    e.preventDefault();
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        });

        const data = await response.json();
        if (response.ok) {
            authToken = data.token;
            currentUser = jwtDecode(authToken).id;
            localStorage.setItem('authToken', authToken); // Store token
            updateAuthUI();
            await loadUserShaders();
            authModal.style.display = 'none';
        }
    } catch (err) {
        console.error('Login error:', err);
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken'); // Clear token
    localStorage.removeItem('lastShaderId'); // Clear last shader
    updateAuthUI();
    editor.value = DEFAULT_SHADER_CODE;
    compileShader(DEFAULT_SHADER_CODE);
}

// JWT decode helper
function jwtDecode(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch {
        return null;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            authToken = data.token;
            currentUser = jwtDecode(authToken).id;
            updateAuthUI();
            createNewShader();
            authModal.style.display = 'none';
            authForm.reset();
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }
    } catch (err) {
        console.error('Registration error:', err);
        showNotification('Registration failed', 'error');
    }
}

// Update auth UI function
function updateAuthUI() {
    if (currentUser) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        shaderListContainer.style.display = 'block';
        document.getElementById('update-btn').style.display = 'block'; // Show save button
    } else {
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        shaderListContainer.style.display = 'none';
        document.getElementById('update-btn').style.display = 'none'; // Hide save button
    }
}

// Shader Functions
async function loadUserShaders() {
    try {
        const response = await fetch('/api/shaders', {
            headers: { 'x-auth-token': authToken }
        });

        if (response.ok) {
            const shaders = await response.json();
            renderShaderList(shaders);
        }
    } catch (err) {
        console.error('Error loading shaders:', err);
    }
}

// Modified shader list click handler
function renderShaderList(shaders) {
    shaderList.innerHTML = '';
    shaders.forEach(shader => {
        const li = document.createElement('li');
        li.dataset.id = shader._id;
        // Shader title (editable span)
        const titleSpan = document.createElement('span');
        titleSpan.textContent = shader.title;
        titleSpan.contentEditable = false;
        titleSpan.className = 'shader-title';

        // Action Buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'shader-actions';

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.title = 'Edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEditShader(shader._id, titleSpan);
        });

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteShader(shader._id);
        });

        actionsDiv.append(editBtn, deleteBtn);
        li.append(titleSpan, actionsDiv);
        // Click handler to load shader
        li.addEventListener('click', (e) => {
            if (!e.target.classList.contains('edit-icon') &&
                !e.target.classList.contains('delete-icon')) {
                currentShaderId = shader._id;
                loadShader(shader._id);
            }
        });
        shaderList.appendChild(li);
    });
}

// Updated loadShader function
async function loadShader(shaderId) {
    try {
        const response = await fetch(`/api/shaders/${shaderId}`, {
            headers: { 'x-auth-token': authToken }
        });

        if (response.ok) {
            const shader = await response.json();
            currentShaderId = shader._id;
            localStorage.setItem('lastShaderId', shader._id); // Remember last shader
            editor.value = shader.code;
            compileShader(shader.code);
        }
    } catch (err) {
        console.error('Shader load error:', err);
    }
}

async function createNewShader() {
    const title = prompt('Enter shader name:');
    if (!title) return;

    try {
        const response = await fetch('/api/shaders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify({
                title,
                code: editor.value || DEFAULT_SHADER_CODE
            })
        });

        if (response.ok) {
            const shader = await response.json();
            showNotification('Shader created successfully!');
            loadUserShaders();
            loadShader(shader._id);
        } else {
            showNotification('Failed to create shader', 'error');
        }
    } catch (err) {
        showNotification('Failed to create shader', 'error');
    }
}

// Helper function to decode JWT
function jwtDecode(token) {
    return JSON.parse(atob(token.split('.')[1]));
}

// Update your existing compileShader function to auto-save changes
let saveTimeout;


editor.addEventListener('input', () => {
    if (autoUpdateCheckbox.checked) {
        compileShader(editor.value);
    }

    // Auto-save after 2 seconds of inactivity
    if (currentUser) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveCurrentShader, 2000);
    }
});

async function saveCurrentShader() {
    const activeShader = document.querySelector('#shader-list li.active');
    if (!activeShader) return;

    try {
        await fetch(`/api/shaders/${activeShader.dataset.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify({
                code: editor.value
            })
        });
    } catch (err) {
        console.error('Error saving shader:', err);
    }
}

// Toggle edit mode for shader name
async function toggleEditShader(shaderId, titleElement) {
    if (titleElement.contentEditable === 'true') {
        titleElement.contentEditable = 'false';
        try {
            await updateShaderName(shaderId, titleElement.textContent);
            showNotification('Shader renamed successfully!');
        } catch (error) {
            showNotification('Failed to rename shader', 'error');
        }
    } else {
        titleElement.contentEditable = 'true';
        titleElement.focus();
    }
}

// Update shader name
async function updateShaderName(shaderId, newName) {
    try {
        const response = await fetch(`/api/shaders/update-name/${shaderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authToken
            },
            body: JSON.stringify({ title: newName })
        });

        if (!response.ok) showNotification('Failed to update shader name', 'error');
    } catch (err) {
        console.error('Error updating shader name:', err);
        showNotification('Failed to update shader name', 'error');
    }
}

// Delete shader
async function deleteShader(shaderId) {
    if (!confirm('Are you sure you want to delete this shader?')) return;

    try {
        const response = await fetch(`/api/shaders/${shaderId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': authToken }
        });

        if (response.ok) {
            showNotification('Shader deleted successfully!');
            loadUserShaders();
            if (currentShaderId === shaderId) {
                currentShaderId = null;
                editor.value = '';
                if (shaderList.children.length > 0) {
                    await loadShader(shaderList.children[0].dataset.id);
                }
            }
        } else {
            showNotification('Failed to delete shader', 'error');
        }
    } catch (err) {
        showNotification('Failed to delete shader', 'error');
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notification-message');

    // Set message and style
    messageEl.textContent = message;
    notification.className = `notification-visible notification-${type}`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.classList.replace('notification-visible', 'notification-hidden');
    }, 5000);
}
// Sidebar Toggle
document.getElementById('toggle-sidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('shader-list-container');
    const toggleBtn = document.getElementById('toggle-sidebar');

    sidebar.classList.toggle('collapsed');
    toggleBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
});

// Password Visibility Toggle
// Update password toggle logic
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', (e) => {
        const icon = e.target.querySelector('i') || e.target;
        const input = e.target.closest('.input-with-toggle').querySelector('input');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
});