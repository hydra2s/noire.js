import { default as B } from "./library/basic.js";
import { default as V } from "./deps/vulkan.node.js/index.js";
import { default as K } from "./library/noire.js"
import fs from "fs";
import { default as $M } from "gl-matrix"

//
const nrUniformData = new Proxy(V.CStructView, new V.CStruct("nrUniformData", {
    perspective: "f32[16]",
    modelView: "f32[16]",
    accelerationStructure: "u64",
    nodeBuffer: "u64"
}));

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
    const gltfModel = await gltfLoaderA.load("Cube.gltf");
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
    const triangleObj = deviceObj.createComputePipeline({
        pipelineLayout: descriptorsObj.handle[0],
        code: await fs.promises.readFile("shaders/triangle.comp.spv")
    });

    //
    const uniformData = new nrUniformData({
        perspective: $M.mat4.transpose(new Float32Array(16), $M.mat4.perspective(new Float32Array(16), 60 / 180 * Math.PI, windowSize[0]/windowSize[1], 0.0001, 10000.0)),
        modelView: $M.mat4.transpose(new Float32Array(16), $M.mat4.lookAt(new Float32Array(16), [0.0, 0.0, -1.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0])),
        accelerationStructure: gltfModel.nodeAccelerationStructure.getDeviceAddress(),
        nodeBuffer: gltfModel.nodeBufferGPU.getDeviceAddress()
    });

    // 
    const cmdBufs = deviceObj.allocatePrimaryCommands((cmdBuf, imageIndex)=>{
        swapchainObj.cmdToGeneral(cmdBuf);
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 0, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) }); // clear
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 3, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) });

        descriptorsObj.cmdUpdateUniform(cmdBuf, uniformData.buffer);
        triangleObj.cmdDispatch(cmdBuf, Math.ceil(windowSize[0]/32), Math.ceil(windowSize[1]/4), 1, new Uint32Array([swapchainObj.getStorageDescId(imageIndex)]));

        swapchainObj.cmdToPresent(cmdBuf);
    }, swapchainObj.getImageCount(), 0);

    //
    let lastTime = performance.now();
    const renderGen = async function*() {
        // TODO: dedicated semaphores support
        const imageIndex = swapchainObj.acquireImageIndex();

        // await fence before rendering (and poll events)
        //await awaitFenceAsync(device[0], fence[imageIndex[0]]);
        for await (let R of K.awaitFenceGen(deviceObj.handle[0], fenceI[imageIndex])) { yield R; };
        V.vkDestroyFence(deviceObj.handle[0], fenceI[imageIndex], null); // promise to manually broke fence

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
    let terminated = false;

    //
    console.log("Begin rendering...");
    while (!V.glfwWindowShouldClose(windowObj.window) && !terminated) {
        V.glfwPollEvents();
        deviceObj.tickProcessing();
        //await awaitTick(); // crap, it's needed for async!

        // as you can see, async isn't so async
        //if (!renderer || renderer.status == "ready") { renderer = makeState(renderGen()); };
        if (!renderer || iterator.done) { renderer = renderGen(); };
        iterator = await renderer.next();
    };

    // 
    V.glfwTerminate();

})();

