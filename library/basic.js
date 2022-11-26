import { default as V } from "../deps/vulkan.node.js/index.js";

//
class BasicObj {
    constructor(base, handle) {
        this.base = base;
        this.handle = handle;
    }
}



//
const createShaderModule = (device, shaderSrc) => {
    let shaderModuleInfo = new V.VkShaderModuleCreateInfo({
        pCode: shaderSrc,
        codeSize: shaderSrc.byteLength
    });
    const shaderModule = new BigUint64Array(1);
    V.vkCreateShaderModule(device, shaderModuleInfo, null, shaderModule);
    return shaderModule[0];
}

//
const getMemoryTypeIndex = (physicalDevice, typeFilter, propertyFlag) => {
    let memoryProperties = new V.VkPhysicalDeviceMemoryProperties();
    V.vkGetPhysicalDeviceMemoryProperties(physicalDevice, memoryProperties);
    for (let I = 0; I < memoryProperties.memoryTypeCount; ++I) {
        if (
        (typeFilter & (1 << I)) &&
        (memoryProperties.memoryTypes[I].propertyFlags & propertyFlag) === propertyFlag
        ) {
        return I;
        }
    };
    return -1;
};

//
const createShaderModuleInfo = (module, stage, pName = "main")=>{
    return new V.VkPipelineShaderStageCreateInfo({
        flags: 0, stage, module, pName, pSpecializationInfo: null
    });
}


// TODO: replace by general based buffers
const createTypedBuffer = (physicalDevice, device, usage, byteSize, PTR = null) => {
    //
    const bufferInfo = new V.VkBufferCreateInfo({
        size: byteSize,
        usage: usage | V.VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT | V.VK_BUFFER_USAGE_TRANSFER_SRC_BIT | V.VK_BUFFER_USAGE_TRANSFER_DST_BIT,
        sharingMode: V.VK_SHARING_MODE_EXCLUSIVE,
        queueFamilyIndexCount: 0,
        pQueueFamilyIndices: null
    });

    //
    const buffer = new BigUint64Array(1);
    V.vkCreateBuffer(device, bufferInfo, null, buffer);

    //
    const memoryRequirements = new V.VkMemoryRequirements();
    V.vkGetBufferMemoryRequirements(device, buffer[0], memoryRequirements);

    //
    const propertyFlag = PTR == "BAR" ? (V.VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT | V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT) : (PTR ? (
        V.VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT |
        V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT
    ) : V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);

    //
    const memAllocFlags = new V.VkMemoryAllocateFlagsInfo({
        flags: V.VK_MEMORY_ALLOCATE_DEVICE_ADDRESS_BIT_KHR
    });

    //
    const memAllocInfo = new V.VkMemoryAllocateInfo({
        pNext: memAllocFlags,
        allocationSize: memoryRequirements.size,
        memoryTypeIndex: getMemoryTypeIndex(physicalDevice, memoryRequirements.memoryTypeBits, propertyFlag)
    });

    //
    const bufferMemory = new BigUint64Array(1);
    V.vkAllocateMemory(device, memAllocInfo, null, bufferMemory);
    V.vkBindBufferMemory(device, buffer[0], bufferMemory[0], 0n);

    //
    if (PTR && typeof PTR != "string") {
        //
        const dataPtr = new BigUint64Array(1);
        V.vkMapMemory(device, bufferMemory[0], 0n, bufferInfo.size, 0, dataPtr);

        // gigant spider
        ArrayBuffer.fromAddress(dataPtr[0], bufferInfo.size).set(ArrayBuffer.fromAddress(PTR, bufferInfo.size));
        V.vkUnmapMemory(device, bufferMemory[0]);
    }

    return buffer[0];
}

// TODO: replace by general based buffers
const createVertexBuffer = (physicalDevice, device, vertices) => {
    return createTypedBuffer(physicalDevice, device, V.VK_BUFFER_USAGE_VERTEX_BUFFER_BIT | V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR, vertices.byteLength, vertices);
}

// TODO: replace by general based buffers
const createIndexBuffer = (physicalDevice, device, indices) => {
    return createIndexBuffer(physicalDevice, device, V.VK_BUFFER_USAGE_INDEX_BUFFER_BIT | V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR, indices.byteLength, indices);
}

// TODO: replace by general based buffers
const createInstanceBuffer = (physicalDevice, device, instances) => {
    return createTypedBuffer(physicalDevice, device, V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_STORAGE_BIT_KHR | V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR, instances.byteLength, instances);
}

//
const getBufferDeviceAddress = (device, $buffer)=>{
    return V.vkGetBufferDeviceAddress(device, new V.VkBufferDeviceAddressInfo({ $buffer })); // conflict-less
}

//
const getAcceelerationStructureAddress = (device, accelerationStructure)=>{
    return V.vkGetAccelerationStructureDeviceAddressKHR(device, new V.VkAccelerationStructureDeviceAddressInfoKHR({ accelerationStructure }));
}





//
const awaitTick = ()=> new Promise(setImmediate);
const awaitFenceAsync = async function*(device, fence) {
    let status = V.VK_NOT_READY;
    do {
        await awaitTick(); yield status;
        if (status == V.VK_ERROR_DEVICE_LOST) { throw Error("Vulkan Device Lost"); break; };
        if (status != V.VK_NOT_READY) break;
    } while((status = V.vkGetFenceStatus(device, fence)) != V.VK_SUCCESS);
    return status;
}

//
const makeState = (promise)=>{
    const state_ = { status: 'pending' };
    promise.then(()=>{state_.status="ready"; return awaitTick();});
    promise.catch(()=>{state_.status="reject"; });
    return new Proxy(promise, {
        get(target, prop) {
            if (target instanceof Promise) {
                if (prop == "status") {
                    return state_[prop];
                } else {
                    return target[prop].bind(target);
                }
            }
        }
    });
}

//
const Handles = {};

//
export default { 
    Handles, 
    BasicObj,
    makeState,
    awaitTick,
    awaitFenceAsync,
    createShaderModule,
    getMemoryTypeIndex,
    createShaderModuleInfo,
    createTypedBuffer,
    createVertexBuffer,
    createInstanceBuffer,
    getBufferDeviceAddress,
    getAcceelerationStructureAddress
};
