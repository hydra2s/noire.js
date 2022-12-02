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
    instanceCount: "u32",
    width: "u16", height: "u16",
    windowWidth: "u16", windowHeight: "u16",
    _: "u16[2]",
    framebuffers: "u16[8]",
    frameCount: "u32",
    linearSampler: "u32"
}));

//
Object.defineProperty(Array.prototype, 'chunk', {value: function(n) {
    return new Array(Math.ceil(this.length/n)).fill().map((_,i) => this.slice(i*n,i*n+n));
}});

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

    //
    //const bufferObj = memoryAllocatorObj.allocateMemory({  }, deviceObj.createBuffer({ size: 256*4 }));
    //const hostBufferObj = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: 256*4 }));

    //
    /*const fenceC = deviceObj.submitOnce({
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
    await B.awaitFenceAsync(deviceObj.handle[0], fenceC[0]);*/

    //
    const gltfLoaderA = new K.GltfLoaderObj(deviceObj.handle, {
        pipelineLayout: descriptorsObj.handle[0],
        memoryAllocator: memoryAllocatorObj.handle[0],
    });

    //
    //console.log(await gltfLoaderA.load("Cube.gltf"));
    //console.log();

    //
    //const readData = new Uint32Array(hostBufferObj.map());
    //console.log(readData);

    // // // // // // //
    // THE CONTINUE!  //
    // // // // // // //

    // TODO: upscaling support
    const DPI = new Float32Array([1.0, 1.0]); V.glfwGetMonitorContentScale(V.glfwGetPrimaryMonitor(), DPI);
    const windowObj = instanceObj.createWindow({ /*width: 1920, height: 1080*/ width: Math.ceil(1920 * DPI[0] / 2.0), height: Math.ceil(1080 * DPI[1] / 2.0) });
    const swapchainObj = deviceObj.createSwapChain({ window: windowObj, pipelineLayout: descriptorsObj.handle[0] });

    //
    const framebufferLayoutObj = deviceObj.createFramebufferLayout({
        colorAttachments: [
            {   // data indices
                blend: {},
                format: V.VK_FORMAT_R32G32B32A32_UINT,
                dynamicState: {
                    clearValue: new Uint32Array([0, 0, 0, 0])
                }
            },
            {   // barycentrics
                blend: {},
                format: V.VK_FORMAT_R32G32B32A32_SFLOAT,
                dynamicState: {
                    clearValue: new Float32Array([0.0, 0.0, 0.0, 0.0]).as("u32[4]")
                }
            },
            {   // positions
                blend: {},
                format: V.VK_FORMAT_R32G32B32A32_SFLOAT,
                dynamicState: {
                    clearValue: new Float32Array([0.0, 0.0, 1.0, 1.0]).as("u32[4]")
                }
            },
            {   // diffuse or render output
                storage: true,
                blend: {},
                format: V.VK_FORMAT_R16G16B16A16_SFLOAT,
                dynamicState: {
                    clearValue: new Float32Array([0.0, 0.0, 0.0, 1.0]).as("u32[4]")
                }
            },
            {   // re-output output
                storage: true,
                blend: {},
                format: V.VK_FORMAT_R16G16B16A16_SFLOAT,
                dynamicState: {
                    clearValue: new Float32Array([0.0, 0.0, 0.0, 1.0]).as("u32[4]")
                }
            },
            {   // normals
                storage: true,
                blend: {},
                format: V.VK_FORMAT_R16G16B16A16_SFLOAT,
                dynamicState: {
                    clearValue: new Float32Array([0.0, 0.0, 0.0, 1.0]).as("u32[4]")
                }
            }
        ],
        depthAttachment: {
            format: V.VK_FORMAT_D32_SFLOAT_S8_UINT,
            dynamicState: {}
        },
        stencilAttachment: {
            format: V.VK_FORMAT_D32_SFLOAT_S8_UINT,
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
    const frameSize = new Uint16Array([1920, 1080]);

    //
    const framebufferObj = deviceObj.createFramebuffer({
        memoryAllocator: memoryAllocatorObj.handle[0],
        framebufferLayout: framebufferLayoutObj.handle[0],
        pipelineLayout: descriptorsObj.handle[0],
        extent: {width: frameSize[0], height: frameSize[1], depth: 1}
    });

    //
    const viewport = [{ x: 0, y: frameSize[1], width: frameSize[0], height: -frameSize[1], minDepth: 0.0, maxDepth: 1.0 }];
    const scissor = [{ ["offset:u32[2]"]: [0,0], ["extent:u32[2]"]: frameSize}];

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
            framebufferObj.cmdFromUndefined(cmdBuf);
            swapchainObj.cmdFromUndefined(cmdBuf);
        }
    });

    //
    await B.awaitFenceAsync(deviceObj.handle[0], fenceB[0]);

    //
    const pipelineObj = deviceObj.createComputePipeline({
        framebufferLayout: framebufferLayoutObj.handle[0],
        pipelineLayout: descriptorsObj.handle[0],
        code: await fs.promises.readFile("shaders/final.comp.spv")
    });

    //
    //const gltfModel = await gltfLoaderA.load("models/BoomBox.gltf");
    //const gltfModel = await gltfLoaderA.load("models/BoomBoxWithAxes.gltf");
    const gltfModel = await gltfLoaderA.load("sponza/Sponza.gltf");
    //const gltfModel = await gltfLoaderA.load("models/MetalRoughSpheres.gltf");
    const triangleObj = deviceObj.createComputePipeline({
        pipelineLayout: descriptorsObj.handle[0],
        code: await fs.promises.readFile("shaders/triangle.comp.spv")
    });

    // Not Suitable
    /*const denoiserObj = deviceObj.createComputePipeline({
        framebufferLayout: framebufferLayoutObj.handle[0],
        pipelineLayout: descriptorsObj.handle[0],
        code: await fs.promises.readFile("shaders/denoise-phase-2.comp.spv")
    });*/


    //
    let mouseMoving = false;
    let cameraMoving = false;
    let moveDir = $M.vec3.fromValues(0,0,0);
    let viewDir = $M.vec3.fromValues(0,0,1);
    let lastX = 0.0, lastY = 0.0;

    //
    let eye = $M.vec3.fromValues(0,0,0.0,0.0);
    let center = $M.vec3.add($M.vec3.create(), eye, viewDir);
    let up = $M.vec3.fromValues(0,1,0);

    //
    const perspective = Array.from($M.mat4.perspective($M.mat4.create(), 60.0 * Math.PI / 180.0, frameSize[0]/frameSize[1], 0.001, 10000.0));
    const modelView = $M.mat4.lookAt($M.mat4.create(), eye, center, up);
    const uniformData = new nrUniformData({
        width: frameSize[0], height: frameSize[1],
        windowWidth: windowSize[0], windowHeight: windowSize[1],
        perspective: $M.mat4.transpose($M.mat4.create(), perspective),
        perspectiveInverse: $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), perspective)),
        modelView: $M.mat4.transpose($M.mat4.create(), modelView),
        modelViewInverse: $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), modelView)),
        accelerationStructure: gltfModel.nodeAccelerationStructure.getDeviceAddress(),
        nodeBuffer: gltfModel.nodeBufferGPU.getDeviceAddress(),
        instanceCount: gltfModel.nodeData.length,
        framebuffers: [
            framebufferObj.colorImageViews[0].DSC_ID, 
            framebufferObj.colorImageViews[1].DSC_ID, 
            framebufferObj.colorImageViews[2].DSC_ID, 
            framebufferObj.colorImageViews[3].DSC_ID,
            framebufferObj.colorImageViews[4].DSC_ID,
            framebufferObj.colorImageViews[5].DSC_ID,
            //framebufferObj.colorImageViews[6].DSC_ID
        ],
        linearSampler: deviceObj.createSampler({
            pipelineLayout: descriptorsObj.handle[0],
            samplerInfo: {
                magFilter: V.VK_FILTER_LINEAR,
                minFilter: V.VK_FILTER_LINEAR,
                addressModeU: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                addressModeV: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                addressModeW: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
            }
        }).DSC_ID
    });

    //
    let frameCount = 0;
    const updateMatrices = ()=>{
        const modelView = $M.mat4.lookAt($M.mat4.create(), eye, $M.vec3.add($M.vec3.create(), eye, viewDir), up);
        uniformData.modelView = $M.mat4.transpose($M.mat4.create(), modelView);
        uniformData.modelViewInverse = $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), modelView));
        uniformData.frameCount = frameCount++;
    };

    // 
    // TODO: Make Indirect Draw Calls!
    // Needs for reusing this command!
    // When change resolution, needs rebuild commands too.
    // Uniform buffer currently not required to command rebuild.
    const cmdBufs = deviceObj.allocatePrimaryCommands((cmdBuf, imageIndex)=>{
        
        // for test FPS
        gltfModel.meshes.map((mesh)=>{
            mesh.accelerationStructure.cmdBuild(cmdBuf, mesh.geometries.map((G,I)=>({
                primitiveCount: gltfModel.geometries[G].primitiveCount,
                primitiveOffset: 0,
                firstVertex: 0,
                transformOffset: 0
            })))
        });

        gltfModel.nodeAccelerationStructure.cmdBuild(cmdBuf, [{
            primitiveCount: gltfModel.instancedData.length,
            primitiveOffset: 0,
            firstVertex: 0,
            transformOffset: 0
        }]);

        //
        swapchainObj.cmdToGeneral(cmdBuf);

        // 
        descriptorsObj.cmdBarrier(cmdBuf);
        framebufferObj.cmdToAttachment(cmdBuf);
        graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 0, scissor, viewport, framebuffer: framebufferObj.handle[0] });
        gltfModel.instancedData.map((D, I)=>{
            const pushData = new Uint32Array([swapchainObj.getStorageDescId(imageIndex), I]);
            const mesh = gltfModel.meshes[D.node.meshIndex];
            graphicsPipelineObj.cmdDraw({ cmdBuf, vertexInfo: mesh.multiDraw, scissor, viewport, framebuffer: framebufferObj.handle[0], pushConstRaw: pushData });
        });
        graphicsPipelineObj.cmdBarrier(cmdBuf);

        framebufferObj.cmdToGeneral(cmdBuf);
        triangleObj.cmdDispatch(cmdBuf, Math.ceil( frameSize[0]/32), Math.ceil( frameSize[1]/6), 1, new Uint32Array([swapchainObj.getStorageDescId(imageIndex)]));
        //denoiserObj.cmdDispatch(cmdBuf, Math.ceil( frameSize[0]/16), Math.ceil( frameSize[1]/16), 1, new Uint32Array([swapchainObj.getStorageDescId(imageIndex)]));
        pipelineObj.cmdDispatch(cmdBuf, Math.ceil(windowSize[0]/32), Math.ceil(windowSize[1]/6), 1, new Uint32Array([swapchainObj.getStorageDescId(imageIndex)]));
        
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
    let mX = 0, mY = 0;
    V.glfwSetCursorPosCallback(windowObj.getWindow(), (window, dx, dy)=>{
        mX = dx, mY = dy;
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
        const modelViewInverse = $M.mat4.invert($M.mat4.create(), modelView);
        const currentTime = performance.now();
        const dT = currentTime - camTime;
        camTime = currentTime;

        //
        const dX = (mX - lastX) / windowSize[1] / DPI[1] * 2.0;
        const dY = (mY - lastY) / windowSize[1] / DPI[1] * 2.0;

        //
        const viewSpeed = 0.0001;
        let localEye = $M.vec4.transformMat4($M.vec4.create(), $M.vec4.fromValues(...eye, 1.0), $M.mat4.copy($M.mat4.create(), modelView)).subarray(0, 3);
        let moveVec = $M.vec3.create(0,0,0);

        //
        if (keys[V.GLFW_KEY_W]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,0,-1)); };
        if (keys[V.GLFW_KEY_S]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,0,1)); };
        if (keys[V.GLFW_KEY_A]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(-1,0,0)); };
        if (keys[V.GLFW_KEY_D]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(1,0,0)); };
        if (keys[V.GLFW_KEY_LEFT_SHIFT]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,-1,0)); };
        if (keys[V.GLFW_KEY_SPACE]) { moveVec = $M.vec3.add($M.vec3.create(), moveVec, $M.vec3.fromValues(0,1,0)); };

        // TODO: DPI scaling support
        const xrot = $M.mat4.fromRotation($M.mat4.create(), dX, $M.vec3.fromValues(0.0, -1.0, 0.0));
        const yrot = $M.mat4.fromRotation($M.mat4.create(), dY, $M.vec3.fromValues(-1.0, 0.0, 0.0));

        //
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
            $M.mat4.copy($M.mat4.create(), modelViewInverse)
        ).subarray(0, 3);

        //
        if (mouseMoving) {
            let localView = $M.vec4.transformMat4($M.vec4.create(), $M.vec4.fromValues(...viewDir, 0.0), $M.mat4.transpose($M.mat4.create(), modelViewInverse));
            localView = $M.vec4.transformMat4($M.vec4.create(), localView, xrot);
            localView = $M.vec4.transformMat4($M.vec4.create(), localView, yrot);
            viewDir = $M.vec4.transformMat4($M.vec4.create(), localView, $M.mat4.transpose($M.mat4.create(), modelView)).subarray(0, 3);
        }

        //
        lastX = mX, lastY = mY;

    };

    //
    let terminated = false;
    let filterStrength = 20;
    let frameTime = performance.now(), lastLoop = performance.now(), thisLoop = performance.now();
    let interval = performance.now();

    //
    const renderGen = async function*() {
        // TODO: dedicated semaphores support
        const imageIndex = swapchainObj.acquireImageIndex();

        // await fence before rendering (and poll events)
        //await awaitFenceAsync(device[0], fence[imageIndex[0]]);
        for await (let R of K.awaitFenceGen(deviceObj.handle[0], fenceI[imageIndex])) { yield R; };
        V.vkDestroyFence(deviceObj.handle[0], fenceI[imageIndex], null); // promise to manually broke fence

        // TODO: use host memory for synchronize
        // use mapped memory
        updateMatrices();
        descriptorsObj.updateUniformDirect(uniformData);

        //
        const previousTime = thisLoop;
        const thisFrameTime = (thisLoop = performance.now()) - lastLoop;
        frameTime += (thisFrameTime - frameTime) / filterStrength;
        lastLoop = thisLoop;

        //
        interval += thisLoop - previousTime;

        //
        if (interval >= 100) {
            interval %= 100;
            console.log("FPS: " + Math.round(Math.max(1000/frameTime, 1)));
        }

        // 
        fenceI[imageIndex] = deviceObj.submitCommands({
            waitStageMasks: [ V.VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT ],
            waitSemaphores: swapchainObj.semaphoreImageAvailable,
            signalSemaphores: swapchainObj.semaphoreRenderingAvailable,
            queueFamilyIndex: 0,
            queueIndex: 0,
            cmdBuf: new BigUint64Array([cmdBufs[imageIndex]]),
            manualFence: true
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

        //await awaitTick(); // crap, it's needed for async!
        // as you can see, async isn't so async
        //if (!renderer || renderer.status == "ready") { renderer = makeState(renderGen()); };
        if (!renderer || iterator.done) { renderer = renderGen(); };
        iterator = await renderer.next();
    };

    // 
    V.glfwTerminate();

})();

