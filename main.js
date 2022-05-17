/**@type {HTMLCanvasElement}*/
const canvas = glcanvas;

const gl = canvas.getContext("webgl");

const root = document.querySelector("html");
function resizeCanvas() {
    canvas.width = root.clientWidth;
    canvas.height = root.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

resizeCanvas();
addEventListener('resize', resizeCanvas);

window.onload = () => {
    if (gl === null) return alert("Unable to initialize WebGL. Your browser/machine may not support it.");
    clearScene();
    draw();
}

function clearScene() {
    //black, opaque
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    //Clear color buffer
    gl.clear(gl.COLOR_BUFFER_BIT);
}

function getUniforms(program, names) {
    let uniforms = {}
    for (const n of names) uniforms[n] = gl.getUniformLocation(program, n);
    return uniforms
}

function getAttributes(program, names) {
    let attribs = {}
    for (const n of names) attribs[n] = gl.getAttribLocation(program, n);
    return attribs
}

function hexToRGBA(hex) {
    const vals = [];
    for (let i = 0; i < 3; ++i) {
        vals[i] = parseInt(hex.slice(i*2+1, i*2+3), 16) / 0xFF;
    }
    vals[3] = 1.0;
    return vals;
}

// language=GLSL
const vsSource =
`
    attribute vec4 vertexPosition;
    uniform float time;
    uniform float outerRadius;
    uniform vec2 view;
    uniform vec2 rad; // [min, max]
    uniform vec2 pos;
    
    void main() {
        gl_Position = vertexPosition;
    }
`;

// language=GLSL
const fsSource =
`
    precision highp float;

    uniform vec2 pos;
    uniform vec2 rad; // [min, max]
    uniform float time;
    uniform float spinSpeed;
    
    uniform float outerRadius;

    uniform float numCircles;

    uniform float sizeSpotChange;
    
    uniform vec4 colorA;
    uniform vec4 colorB;
    
    uniform float colorMod;

    float dist;

    vec4 background = vec4(1.0, 1.0, 1.0, 1.);

    //Consider using distanceSquared instead of distance for efficiency
    float distanceSquared(vec2 a, vec2 b) {
        float x = a.x - b.x;
        float y = a.y - b.y;
        return x*x + y*y;
    }

    const float PI = 3.14159265358979;

    const float MAX_CIRCLES = 20.0;

    vec2 aroundCircle(float percent, float radius) {
        return vec2(cos(2.0*PI * percent), sin(2.0*PI * percent)) * radius;
    }
    
    float smoothify(float x, float mod) {
        return (cos(2. * PI * x + mod) + 1.) / 2.;
    }
    
    void main() {
        
        gl_FragColor = background;
        
        bool changed = false;
        
        for (float i = 0.0; i < MAX_CIRCLES; ++i) { // GLSL requires a constant max iterations
            if (i >= numCircles) break; // but we can break early
            float percentCircle = i/numCircles + time * spinSpeed;
            // absolute value cosine wave scrunched to be between [0.4, 1] multiplied by constant radius
            // an increasing sizeSpotChange means the spots that have high and low sizes are changing
            float r = mix(rad[0], rad[1], smoothify(percentCircle, sizeSpotChange));
            if ((dist = distance(gl_FragCoord.xy, pos + aroundCircle(percentCircle, outerRadius))) < r) {
                changed = true;
                gl_FragColor *= mix(mix(colorA, colorB, smoothify(percentCircle, colorMod)), background, dist / r);
                // overlapping colors stack multiplicatav
            }
        }
        if (!changed) discard;
    }
`

function draw() {
    const MAX_CIRCLES = 20

    const program = initShaderProgram(vsSource, fsSource);

    const payload = {
        program: program,
        uniforms: getUniforms(program, ['pos', 'rad', 'time','spinSpeed', 'outerRadius',
            'numCircles', 'sizeSpotChange', 'view', 'colorA', 'colorB', 'colorMod']),
        attributes: getAttributes(program, ['vertexPosition']),
    }
    gl.useProgram(program);


    let spinSpeed;
    spinSpeedInput.oninput = () => {
        gl.uniform1f(payload.uniforms.spinSpeed, spinSpeed = spinSpeedInput.value);
    }
    spinSpeedInput.oninput();

    colorAInput.oninput = () => {
        gl.uniform4f(payload.uniforms.colorA, ...hexToRGBA(colorAInput.value));
    }
    colorAInput.oninput();

    colorBInput.oninput = () => {
        gl.uniform4f(payload.uniforms.colorB, ...hexToRGBA(colorBInput.value));
    }
    colorBInput.oninput();

    let numCircles = 1;
    numCirclesInput.oninput = () => {
        gl.uniform1f(payload.uniforms.numCircles, numCircles = numCirclesInput.value);
    }
    numCirclesInput.oninput();

    document.onclick1 = () => {
        if (numCircles < MAX_CIRCLES)
            gl.uniform1f(payload.uniforms.numCircles, ++numCircles);
        else if (spinSpeed < 2)
            gl.uniform1f(payload.uniforms.spinSpeed, spinSpeed+=0.1);
        else {
            gl.uniform1f(payload.uniforms.numCircles, (numCircles = 1));
            gl.uniform1f(payload.uniforms.spinSpeed, (spinSpeed = 0.2));
        }
            
    }

    let outerRadius;

    const doMoveCenterXY = false;

    let circleRadius;

    let circleRadiusModMin;
    let circleRadiusModMax;
    circleMinRadiusInput.oninput = () => {
        circleRadiusModMin = circleMinRadiusInput.value;
        calcRelativeSizes();
    }
    circleMaxRadiusInput.oninput = () => {
        circleRadiusModMax = circleMaxRadiusInput.value;
        calcRelativeSizes();
    }

    let outerRadiusMod = 0.2;
    outerRadiusInput.oninput = () => {
        outerRadiusMod = outerRadiusInput.value;
        calcRelativeSizes();
    }

    let r = 0;
    let dr = 2;

    let colorMod = 0;
    let deltaColorMod = -2;

    let cx = canvas.width / 2;
    let cy = canvas.height / 2;
    let dcx = 1;
    let dcy = 1;

    circleMinRadiusInput.oninput();
    circleMaxRadiusInput.oninput();
    outerRadiusInput.oninput();

    function calcRelativeSizes() {
        gl.uniform2f(payload.uniforms.view, canvas.width, canvas.height);
        dcx = canvas.width / 5;
        dcy = canvas.height / 7;
        cx = canvas.width / 2;
        cy = canvas.height / 2;
        outerRadius = Math.min(canvas.width, canvas.height) * outerRadiusMod;
        gl.uniform1f(payload.uniforms.outerRadius, outerRadius);
        circleRadius = {min: outerRadius * circleRadiusModMin, max: outerRadius * circleRadiusModMax};
        gl.uniform2f(payload.uniforms.rad, circleRadius.min, circleRadius.max);
    }
    calcRelativeSizes()
    addEventListener("resize", calcRelativeSizes);

    let prev;
    function update(timestamp) {
        const dt = (timestamp - prev) / 1000;
        prev = timestamp;

        r += dr * dt;

        if (doMoveCenterXY) {
            const nextcx = cx + dcx * dt;
            if (nextcx + outerRadius + circleRadius.min > canvas.width || nextcx < outerRadius + circleRadius.min) dcx = -dcx;
            else cx = nextcx;

            const nextcy = cy + dcy * dt;
            if (nextcy + outerRadius + circleRadius.min > canvas.height || nextcy < outerRadius + circleRadius.min) dcy = -dcy;
            else cy = nextcy;
        }
        gl.uniform2f(payload.uniforms.pos, cx, cy);

        gl.uniform1f(payload.uniforms.sizeSpotChange, r);
        colorMod += deltaColorMod * dt;
        gl.uniform1f(payload.uniforms.colorMod, colorMod);
        gl.uniform1f(payload.uniforms.time, timestamp / 1000);

        drawScene(payload, initBuffers());
        requestAnimationFrame(update);
    }
    requestAnimationFrame(timestamp => {
        prev = timestamp;
        update(timestamp);
    })
}


function initBuffers() {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positions = [
        1, 1,
        -1, 1,
        1, -1,
        -1, -1,
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
    };
}

function drawScene(program, buffers) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //full clear
    gl.clearDepth(1.0);
    //enable depth testing 
    gl.enable(gl.DEPTH_TEST);
    //close obscures far
    gl.depthFunc(gl.LEQUAL);

    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(program.attributes.vertexPosition, numComponents, type, normalize, stride, offset);
        
        gl.enableVertexAttribArray(program.attributes.vertexPosition);
    }


    {
        const offset = 0;
        const vertexCount = 4;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
}

function loadShader(typeName, source) {
    const shader = gl.createShader(gl[typeName]);

    //Send source to shader object
    gl.shaderSource(shader, source);

    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Compiling shader (${typeName}): ${gl.getShaderInfoLog(shader)}`);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initShaderProgram(vsSource, fsSource) {
    const vertexShader = loadShader('VERTEX_SHADER', vsSource);
    const fragmentShader = loadShader('FRAGMENT_SHADER', fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Unable to initalize the shader program: " + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    

    return shaderProgram;
}