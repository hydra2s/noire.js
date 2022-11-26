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

    deviceObj.submitOnce({
        queueFamilyIndex: 0,
        queueIndex: 0,
        cmdBufFn: (cmdBuf)=>{
            pipelineObj.dispatch(cmdBuf, 1, 1, 1);
        }
    });

    
})();

