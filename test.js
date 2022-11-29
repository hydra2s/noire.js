import { default as B } from "./library/basic.js";
import { default as V } from "./deps/vulkan.node.js/index.js";
import { default as K } from "./library/noire.js"
import fs from "fs";
import { default as $M } from "gl-matrix"

//
const nrUniformData = new Proxy(V.CStructView, new V.CStruct("nrUniformData", {
    perspective: "f32[16]",
    perspectiveInverse: "f32[16]",
    modelView: "f32[16]",
    modelViewInverse: "f32[16]",
    accelerationStructure: "u64",
    nodeBuffer: "u64",
    instanceCount: "u32"
}));


//
Object.defineProperty(Array.prototype, 'chunk', {value: function(n) {
    return Array(ceil(this.length/n)).fill().map((_,i) => this.slice(i*n,i*n+n));
}});



function invert(invOut, m) {
    let inv = $M.mat4.create(), det;
    let i;

    inv[0]  =  m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4]  = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8]  =  m[4] * m[9]  * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9]  * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1]  = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5]  =  m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9]  = -m[0] * m[9]  * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] =  m[0] * m[9]  * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2]  =  m[1] * m[6]  * m[15] - m[1] * m[7]  * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7]  - m[13] * m[3] * m[6];
    inv[6]  = -m[0] * m[6]  * m[15] + m[0] * m[7]  * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7]  + m[12] * m[3] * m[6];
    inv[10] =  m[0] * m[5]  * m[15] - m[0] * m[7]  * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7]  - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5]  * m[14] + m[0] * m[6]  * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6]  + m[12] * m[2] * m[5];
    inv[3]  = -m[1] * m[6]  * m[11] + m[1] * m[7]  * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9]  * m[2] * m[7]  + m[9]  * m[3] * m[6];
    inv[7]  =  m[0] * m[6]  * m[11] - m[0] * m[7]  * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8]  * m[2] * m[7]  - m[8]  * m[3] * m[6];
    inv[11] = -m[0] * m[5]  * m[11] + m[0] * m[7]  * m[9]  + m[4] * m[1] * m[11] - m[4] * m[3] * m[9]  - m[8]  * m[1] * m[7]  + m[8]  * m[3] * m[5];
    inv[15] =  m[0] * m[5]  * m[10] - m[0] * m[6]  * m[9]  - m[4] * m[1] * m[10] + m[4] * m[2] * m[9]  + m[8]  * m[1] * m[6]  - m[8]  * m[2] * m[5];

    det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (det == 0) return false;
    det = 1.0 / det;

    for (i = 0; i < 16; i++)
        invOut[i] = inv[i] * det;

    return true;
}


function affineInvert(out, a) {
    let a00 = a[0],
        a01 = a[1],
        a02 = a[2];

    let a10 = a[4],
        a11 = a[5],
        a12 = a[6];
    
    let a20 = a[8],
        a21 = a[9],
        a22 = a[10];

    let b01 = a22 * a11 - a12 * a21;
    let b11 = -a22 * a10 + a12 * a20;
    let b21 = a21 * a10 - a11 * a20;

    // Calculate the determinant
    let det = a00 * b01 + a01 * b11 + a02 * b21;

    if (!det) {
        return null;
    }

    let t0 = -a[12],
        t1 = -a[13],
        t2 = -a[14];

    det = 1.0 / det;

    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = 0;
    out[4] = b11 * det;
    out[5] = (a22 * a00 - a02 * a20) * det;
    out[6] = (-a12 * a00 + a02 * a10) * det;
    out[7] = 0;
    out[8] = b21 * det;
    out[9] = (-a21 * a00 + a01 * a20) * det;
    out[10] = (a11 * a00 - a01 * a10) * det;
    out[11] = 0;
    out[12] = out[0] * t0 + out[4] * t1 + out[8] * t2;
    out[13] = out[1] * t0 + out[5] * t1 + out[9] * t2;
    out[14] = out[2] * t0 + out[6] * t1 + out[10] * t2;
    out[15] = 1;

    return out;
}


//
(async()=>{
    const instanceObj = new K.InstanceObj({  });
    const physicalDevicesObj = instanceObj.enumeratePhysicalDeviceObjs();
    const deviceObj = physicalDevicesObj[0].createDevice({
        queueFamilies: [{
            index: 0,
            queuePriorities: [1.0]
        }]
    });

    //
    const memoryAllocatorObj = deviceObj.createMemoryAllocator({  });
    const descriptorsObj = deviceObj.createDescriptors({ memoryAllocator: memoryAllocatorObj.handle[0] });
    const pipelineObj = deviceObj.createComputePipeline({
        pipelineLayout: descriptorsObj.handle[0],
        code: await fs.promises.readFile("shaders/test.comp.spv")
    });

    //
    const bufferObj = memoryAllocatorObj.allocateMemory({  }, deviceObj.createBuffer({ size: 256*4 }));
    const hostBufferObj = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: 256*4 }));

    //
    const fenceC = deviceObj.submitOnce({
        queueFamilyIndex: 0,
        queueIndex: 0,
        cmdBufFn: (cmdBuf)=>{
            const pushData = new BigUint64Array([bufferObj.getDeviceAddress()]);
            descriptorsObj.cmdUpdateUniform(cmdBuf, new Uint32Array([128]), 0n);
            pipelineObj.cmdDispatch(cmdBuf, 1, 1, 1, pushData);
            bufferObj.cmdCopyToBuffer(cmdBuf, hostBufferObj.handle[0], [{srcOffset: 0, dstOffset: 0, size: 256*4}]);
        }
    });

    //
    await B.awaitFenceAsync(deviceObj.handle[0], fenceC[0]);

    //
    const gltfLoaderA = new K.GltfLoaderObj(deviceObj.handle, {
        pipelineLayout: descriptorsObj.handle[0],
        memoryAllocator: memoryAllocatorObj.handle[0],
    });

    //
    //console.log(await gltfLoaderA.load("Cube.gltf"));
    //console.log();

    //
    const readData = new Uint32Array(hostBufferObj.map());
    console.log(readData);

    // // // // // // //
    // THE CONTINUE!  //
    // // // // // // //

    //
    const windowObj = instanceObj.createWindow({ width: 1280, height: 720 });
    const swapchainObj = deviceObj.createSwapChain({ window: windowObj, pipelineLayout: descriptorsObj.handle[0] });

    //
    const framebufferLayoutObj = deviceObj.createFramebufferLayout({
        colorAttachments: [{
            blend: {},
            format: swapchainObj.getFormat(),
            dynamicState: {}
        }],
        depthAttachment: {
            format: V.VK_FORMAT_UNDEFINED,
            dynamicState: {}
        },
        stencilAttachment: {
            format: V.VK_FORMAT_UNDEFINED,
            dynamicState: {}
        }
    });

    //
    const graphicsPipelineObj = deviceObj.createGraphicsPipeline({
        framebufferLayout: framebufferLayoutObj.handle[0],
        pipelineLayout: descriptorsObj.handle[0],
        shaderStages: {
            [V.VK_SHADER_STAGE_VERTEX_BIT]: {code: await fs.promises.readFile("shaders/triangle.vert.spv")},
            [V.VK_SHADER_STAGE_FRAGMENT_BIT]: {code: await fs.promises.readFile("shaders/triangle.frag.spv")}
        }
    });

    //
    const windowSize = windowObj.getWindowSize();
    const viewport = new V.VkViewport({}); viewport[":f32[6]"] = [0, 0, windowSize[0], windowSize[1], 0.0, 1.0];
    const scissor = new V.VkRect2D({ ["offset:u32[2]"]: [0,0], ["extent:u32[2]"]: windowSize});

    //
    const fenceI = new BigUint64Array(swapchainObj.getImageCount());
    for (let I=0;I<fenceI.length;I++) {
        V.vkCreateFence(deviceObj.handle[0], new V.VkFenceCreateInfo({ flags: V.VK_FENCE_CREATE_SIGNALED_BIT }), null, fenceI.addressOffsetOf(I));
    }

    //
    const fenceB = deviceObj.submitOnce({
        queueFamilyIndex: 0,
        queueIndex: 0,
        cmdBufFn: (cmdBuf)=>{
            swapchainObj.cmdFromUndefined(cmdBuf);
        }
    });

    //
    await B.awaitFenceAsync(deviceObj.handle[0], fenceB[0]);

    //
    //const gltfModel = await gltfLoaderA.load("models/BoomBox.gltf");
    const gltfModel = await gltfLoaderA.load("models/BoomBoxWithAxes.gltf");
    const triangleObj = deviceObj.createComputePipeline({
        pipelineLayout: descriptorsObj.handle[0],
        code: await fs.promises.readFile("shaders/triangle.comp.spv")
    });

    //
    let mouseMoving = false;
    let cameraMoving = false;
    let moveDir = $M.vec3.fromValues(0,0,0);
    let viewDir = $M.vec3.fromValues(0,0,-1);
    let lastX = 0.0, lastY = 0.0;

    //
    let eye = $M.vec3.fromValues(0,0,0.05);
    let center = $M.vec3.add($M.vec3.create(), eye, viewDir);
    let up = $M.vec3.fromValues(0,1,0);

    //
    

    //
    const perspective = $M.mat4.perspective($M.mat4.create(), 90.0 * Math.PI / 360.0, windowSize[0]/windowSize[1], 0.0001, 10000.0);
    const modelView = $M.mat4.lookAt($M.mat4.create(), eye, center, up);
    const uniformData = new nrUniformData({
        perspective: $M.mat4.transpose($M.mat4.create(), perspective),
        perspectiveInverse: $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), perspective)),
        modelView: $M.mat4.transpose($M.mat4.create(), modelView),
        modelViewInverse: $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), modelView)),
        accelerationStructure: gltfModel.nodeAccelerationStructure.getDeviceAddress(),
        nodeBuffer: gltfModel.nodeBufferGPU.getDeviceAddress(),
        instanceCount: gltfModel.nodeData.length
    });

    

    //
    const updateMatrices = ()=>{
        const perspective = $M.mat4.perspective($M.mat4.create(), 90.0 * Math.PI / 360.0, windowSize[0]/windowSize[1], 0.0001, 10000.0);
        const modelView = $M.mat4.lookAt($M.mat4.create(), eye, $M.vec3.add($M.vec3.create(), eye, viewDir), up);
        uniformData.perspective = $M.mat4.transpose($M.mat4.create(), perspective);
        uniformData.perspectiveInverse = $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), perspective));
        uniformData.modelView = $M.mat4.transpose($M.mat4.create(), modelView);
        uniformData.modelViewInverse = $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), modelView));
    };

    // 
    const cmdBufs = deviceObj.allocatePrimaryCommands((cmdBuf, imageIndex)=>{
        swapchainObj.cmdToGeneral(cmdBuf);
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 0, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) }); // clear
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 3, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) });

        //descriptorsObj.cmdUpdateUniform(cmdBuf, uniformData.buffer); // because it's frozen operation
        triangleObj.cmdDispatch(cmdBuf, Math.ceil(windowSize[0]/32), Math.ceil(windowSize[1]/4), 1, new Uint32Array([swapchainObj.getStorageDescId(imageIndex)]));

        swapchainObj.cmdToPresent(cmdBuf);
    }, swapchainObj.getImageCount(), 0);

    //
    const keys = {};

    //
    V.glfwSetKeyCallback(windowObj.getWindow(), (window, key, scancode, action, mods)=>{
        if (action == V.GLFW_PRESS) { cameraMoving = true, keys[key] = true; };
        if (action == V.GLFW_RELEASE) { cameraMoving = false, keys[key] = false; };
    });

    //
    V.glfwSetCursorPosCallback(windowObj.getWindow(), (window, dx, dy)=>{
        if (mouseMoving) {
            const dX = dx - lastX;
            const dY = dy - lastY;

            //
            const modelView = $M.mat4.transpose($M.mat4.create(), $M.mat4.lookAt($M.mat4.create(), eye, $M.vec3.add($M.vec3.create(), eye, viewDir), up));
            const xrot = $M.mat4.fromRotation($M.mat4.create(), dX / 720.0, $M.vec3.fromValues(0.0, -1.0, 0.0));
            const yrot = $M.mat4.fromRotation($M.mat4.create(), dY / 720.0, $M.vec3.fromValues(-1.0, 0.0, 0.0));

            //
            let localView = $M.vec4.transformMat4($M.vec4.create(), $M.vec4.fromValues(...viewDir, 0.0), $M.mat4.invert($M.mat4.create(), modelView));
            localView = $M.vec4.transformMat4($M.vec4.create(), localView, xrot);
            localView = $M.vec4.transformMat4($M.vec4.create(), localView, yrot);
            viewDir = $M.vec4.transformMat4($M.vec4.create(), localView, modelView).subarray(0, 3);
        }
        lastX = dx, lastY = dy;
    });

    //
    V.glfwSetMouseButtonCallback(windowObj.getWindow(), (window, button, action, mods)=>{
        if (button == V.GLFW_MOUSE_BUTTON_1) {
            if (action == V.GLFW_PRESS) { mouseMoving = true; };
            if (action == V.GLFW_RELEASE) { mouseMoving = false; };
        }
    });

    //
    let camTime = performance.now();
    const handleCamera = ()=>{
        const modelView = $M.mat4.lookAt($M.mat4.create(), eye, $M.vec3.add($M.vec3.create(), eye, viewDir), up);
        const currentTime = performance.now();
        const dT = currentTime - lastTime;
        camTime = currentTime;

        //
        const viewSpeed = 0.0001;
        let localEye = $M.vec4.transformMat4($M.vec4.create(), $M.vec4.fromValues(...eye, 1.0), modelView).subarray(0, 3);
        let moveVec = $M.vec3.create(0,0,0);

        if (keys[V.GLFW_KEY_W]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,0,-1)); };
        if (keys[V.GLFW_KEY_S]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,0,1)); };
        if (keys[V.GLFW_KEY_A]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(-1,0,0)); };
        if (keys[V.GLFW_KEY_D]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(1,0,0)); };
        if (keys[V.GLFW_KEY_LEFT_SHIFT]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,-1,0)); };
        if (keys[V.GLFW_KEY_SPACE]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,1,0)); };

        eye = $M.vec4.transformMat4(
            $M.vec4.create(), 
            $M.vec4.fromValues(
                ...$M.vec3.add(
                    $M.vec3.create(), 
                    localEye, 
                    $M.vec3.scale(
                        $M.vec3.create(), 
                        $M.vec3.normalize(
                            $M.vec3.create(), 
                            moveVec
                        ), 
                        dT*viewSpeed
                    )
                ),
                1.0
            ), 
            $M.mat4.invert($M.mat4.create(), modelView)
        ).subarray(0, 3);
    };

    //
    let terminated = false;
    let lastTime = performance.now();
    const renderGen = async function*() {
        // TODO: dedicated semaphores support
        const imageIndex = swapchainObj.acquireImageIndex();

        // await fence before rendering (and poll events)
        //await awaitFenceAsync(device[0], fence[imageIndex[0]]);
        for await (let R of K.awaitFenceGen(deviceObj.handle[0], fenceI[imageIndex])) { yield R; };
        V.vkDestroyFence(deviceObj.handle[0], fenceI[imageIndex], null); // promise to manually broke fence

        // TODO: use host memory for synchronize
        // use mapped memory
        descriptorsObj.updateUniformDirect(uniformData);

        //
        const currentTime = performance.now();
        //console.log("FPS: " + (1000/(currentTime - lastTime)));
        lastTime = currentTime;

        // 
        fenceI[imageIndex] = deviceObj.submitCommands({
            waitStageMasks: [ V.VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT ],
            waitSemaphores: swapchainObj.semaphoreImageAvailable,
            signalSemaphores: swapchainObj.semaphoreRenderingAvailable,
            queueFamilyIndex: 0,
            queueIndex: 0,
            cmdBuf: new BigUint64Array([cmdBufs[imageIndex]])
        });

        // TODO: dedicated semaphores support
        swapchainObj.present({ queue: deviceObj.getQueue(0, 0) });

        //
        return V.VK_SUCCESS;
    }

    //
    let renderer = null, iterator = null;
    let status = V.VK_NOT_READY;

    //
    console.log("Begin rendering...");
    while (!V.glfwWindowShouldClose(windowObj.window) && !terminated) {
        V.glfwPollEvents();
        deviceObj.tickProcessing();
        if (keys[V.GLFW_KEY_ESCAPE]) { terminated = true; };

        //
        handleCamera();
        updateMatrices();

        //await awaitTick(); // crap, it's needed for async!
        // as you can see, async isn't so async
        //if (!renderer || renderer.status == "ready") { renderer = makeState(renderGen()); };
        if (!renderer || iterator.done) { renderer = renderGen(); };
        iterator = await renderer.next();
    };

    // 
    V.glfwTerminate();

})();

