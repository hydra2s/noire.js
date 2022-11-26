import { default as B } from "./library/basic.js";
import { default as V } from "./deps/vulkan.node.js/index.js";
import { default as K } from "./library/kratos.js"

import fs from "fs";

(async()=>{
    const instanceObj = new K.InstanceObj({
    
    });

    const physicalDevicesObj = instanceObj.enumeratePhysicalDeviceObjs();
    const deviceObj = physicalDevicesObj[0].createDevice({
        queueFamilies: [{
            index: 0,
            queuePriorities: [1.0]
        }]
    });

    const memoryAllocatorObj = deviceObj.createMemoryAllocator({
        
    });

    const descriptorsObj = deviceObj.createDescriptors({
        
    });

    const pipelineObj = deviceObj.createComputePipeline({
        pipelineLayout: descriptorsObj.handle[0],
        code: await fs.promises.readFile("shaders/test.comp.spv")
    });

    //
    const bufferObj = memoryAllocatorObj.allocateMemory({  }, deviceObj.createBuffer({ size: 256*4 }));
    const hostBufferObj = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: 256*4 }));

    //
    const fence = deviceObj.submitOnce({
        queueFamilyIndex: 0,
        queueIndex: 0,
        cmdBufFn: (cmdBuf)=>{
            const pushData = new BigUint64Array([bufferObj.getDeviceAddress()]);
            pipelineObj.dispatch(cmdBuf, 1, 1, 1, pushData);
            bufferObj.cmdCopyToBuffer(cmdBuf, hostBufferObj.handle[0], [{srcOffset: 0, dstOffset: 0, size: 256*4}]);
        }
    });

    //
    await B.awaitFenceAsync(deviceObj.handle[0], fence[0]);

    //
    const readData = new Uint32Array(hostBufferObj.map());
    console.log(readData);

    
})();

