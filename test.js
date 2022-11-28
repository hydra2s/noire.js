import { default as B } from "./library/basic.js";
import { default as V } from "./deps/vulkan.node.js/index.js";
import { default as K } from "./library/noire.js"

import fs from "fs";

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
    const vertices = new Float32Array([
        0.0, -0.5,
        0.5,  0.5,
        -0.5,  0.5 
    ]);

    //
    const vertexBuffer = K.createVertexBuffer(physicalDevicesObj[0].handle[0], deviceObj.handle[0], vertices);
    const bottomLevel = deviceObj.createBottomLevelAccelerationStructure({
        geometries: [{
            opaque: true,
            primitiveCount: 1,
            geometry: {
                vertexFormat: V.VK_FORMAT_R32G32_SFLOAT,
                vertexData: K.getBufferDeviceAddress(deviceObj.handle[0], vertexBuffer),
                vertexStride: 8,
                maxVertex: 3
            }
        }]
    });

    //
    const topLevel = deviceObj.createTopLevelAccelerationStructure({
        opaque: true,
        memoryAllocator: memoryAllocatorObj.handle[0],
        instanced: [{
            "transform:f32[12]": [1.0, 0.0, 0.0, 0.0,  0.0, 1.0, 0.0, 0.0,  0.0, 0.0, 1.0, 0.0],
            instanceCustomIndex: 0,
            mask: 0xFF,
            instanceShaderBindingTableRecordOffset: 0,
            flags: 0,
            accelerationStructureReference: bottomLevel.getDeviceAddress()
        }]
    });

    //
    const fenceB = deviceObj.submitOnce({
        queueFamilyIndex: 0,
        queueIndex: 0,
        cmdBufFn: (cmdBuf)=>{
            swapchainObj.cmdFromUndefined(cmdBuf);
            bottomLevel.cmdBuild(cmdBuf, [{
                primitiveCount: 1,
                primitiveOffset: 0,
                firstVertex: 0,
                transformOffset: 0
            }]);
            topLevel.cmdBuild(cmdBuf, [{
                primitiveCount: 1,
                primitiveOffset: 0,
                firstVertex: 0,
                transformOffset: 0
            }]);
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
    const cmdBufs = deviceObj.allocatePrimaryCommands((cmdBuf, imageIndex)=>{
        swapchainObj.cmdToGeneral(cmdBuf);
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 0, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) }); // clear
        //graphicsPipelineObj.cmdDraw({ cmdBuf, vertexCount: 3, scissor, viewport, imageViews: new BigUint64Array([swapchainObj.getImageView(imageIndex)]) });

        const AB = new ArrayBuffer(16), U64 = new BigUint64Array(AB, 0, 1), U32 = new Uint32Array(AB, 8, 1);
        //U64[0] = gltfModel.nodeAccelerationStructure.getDeviceAddress(), U32[0] = swapchainObj.getStorageDescId(imageIndex);
        U64[0] = topLevel.getDeviceAddress(), U32[0] = swapchainObj.getStorageDescId(imageIndex);
        triangleObj.cmdDispatch(cmdBuf, Math.ceil(windowSize[0]/32), Math.ceil(windowSize[1]/4), 1, AB);

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

