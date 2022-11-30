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
        colorAttachments: [
            {
                blend: {},
                format: V.VK_FORMAT_R32G32B32A32_UINT,
                dynamicState: {}
            },
            {
                blend: {},
                format: V.VK_FORMAT_R32G32B32A32_SFLOAT,
                dynamicState: {}
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


    const windowSize = windowObj.getWindowSize();
    const framebufferObj = deviceObj.createFramebuffer({
        framebufferLayout: framebufferLayoutObj.handle[0],
        pipelineLayout: descriptorsObj.handle[0],
        extent: {width: windowSize[0], height: windowSize[1], depth: 1}
    });


    //
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
            framebufferObj.cmdFromUndefined(cmdBuf);
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
    let viewDir = $M.vec3.fromValues(0,0,1);
    let lastX = 0.0, lastY = 0.0;

    //
    let eye = $M.vec3.fromValues(0,0,0.0,0.0);
    let center = $M.vec3.add($M.vec3.create(), eye, viewDir);
    let up = $M.vec3.fromValues(0,1,0);

    //
    const perspective = Array.from($M.mat4.perspective($M.mat4.create(), 60.0 * Math.PI / 180.0, windowSize[0]/windowSize[1], 0.001, 10000.0));
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
        const modelView = $M.mat4.lookAt($M.mat4.create(), eye, $M.vec3.add($M.vec3.create(), eye, viewDir), up);
        uniformData.modelView = $M.mat4.transpose($M.mat4.create(), modelView);
        uniformData.modelViewInverse = $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), modelView));
    };

    // 
    const cmdBufs = deviceObj.allocatePrimaryCommands((cmdBuf, imageIndex)=>{
        swapchainObj.cmdToGeneral(cmdBuf);
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 0, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) }); // clear
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 3, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) });

        //
        framebufferObj.cmdToAttachment(cmdBuf);
        graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 0, scissor, viewport, framebuffer: framebufferObj.handle[0] });
        gltfModel.instancedData.map((D, I)=>{
            const pushData = new Uint32Array([swapchainObj.getStorageDescId(imageIndex), I]);
            const mesh = gltfModel.meshes[D.node.meshIndex];
            //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexInfo: mesh.multiDraw, scissor, viewport, framebuffer: framebufferObj.handle[0], pushConstRaw: pushData });
        });
        framebufferObj.cmdToGeneral(cmdBuf);
        //
        

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

