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

// budget mostly usable only for AMD...
const getMemoryTypeIndex = (physicalDevice, typeFilter, propertyFlag, ignoreFlags = 0, size = 0) => {
    let memoryBudget = new V.VkPhysicalDeviceMemoryBudgetPropertiesEXT();
    let memoryProperties2 = new V.VkPhysicalDeviceMemoryProperties2({ pNext: memoryBudget });
    let memoryProperties = memoryProperties2.memoryProperties;
    V.vkGetPhysicalDeviceMemoryProperties2(physicalDevice, memoryProperties2);
    for (let I = 0; I < memoryProperties.memoryTypeCount; ++I) {
        let prop = memoryProperties.memoryTypes[I];
        if (
            (typeFilter & (1 << I)) &&
            (prop.propertyFlags & propertyFlag) === propertyFlag &&
            (prop.propertyFlags & ignoreFlags) === 0 && 
             memoryBudget.heapBudget[prop.heapIndex] >= size
        ) { return I; }
    };
    return -1;
}

// 
const createShaderModuleInfo = (module, stage, pName = "main")=>{
    return new V.VkPipelineShaderStageCreateInfo({
        flags: 0, stage, module, pName, pSpecializationInfo: null
    });
}

// DEPRECATED!
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
        V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT |
        V.VK_MEMORY_PROPERTY_HOST_CACHED_BIT
    ) : V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);

    //
    const memAllocFlags = new V.VkMemoryAllocateFlagsInfo({
        flags: V.VK_MEMORY_ALLOCATE_DEVICE_ADDRESS_BIT_KHR
    });

    //
    let memoryTypeIndex = getMemoryTypeIndex(physicalDevice, memoryRequirements.memoryTypeBits, propertyFlag, 0, memoryRequirements.size);

    // host memory fallback (but FPS will drop), especially due for budget end
    if (PTR == "BAR" && memoryTypeIndex < 0) { 
        memoryTypeIndex = getMemoryTypeIndex(physicalDevice, memoryRequirements.memoryTypeBits, 
            V.VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT |
            V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT |
            V.VK_MEMORY_PROPERTY_HOST_CACHED_BIT,
            0,
            memoryRequirements.size
        );
    };

    //
    const memAllocInfo = new V.VkMemoryAllocateInfo({
        pNext: memAllocFlags,
        allocationSize: memoryRequirements.size,
        memoryTypeIndex
    });

    //
    const bufferMemory = new BigUint64Array(1);
    V.vkAllocateMemory(device, memAllocInfo, null, bufferMemory);
    V.vkBindBufferMemory(device, buffer[0], bufferMemory[0], 0n);

    //
    if (PTR && typeof PTR != "string") {
        const dataPtr = new BigUint64Array(1);
        V.vkMapMemory(device, bufferMemory[0], 0n, bufferInfo.size, 0, dataPtr);
        V.memcpy(dataPtr[0], PTR, bufferInfo.size);
        V.vkUnmapMemory(device, bufferMemory[0]);
    }

    //
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
const getBufferDeviceAddress = (device, $buffer, byteLength = 1n)=>{
    const deviceAddress = V.vkGetBufferDeviceAddress(device, new V.VkBufferDeviceAddressInfo({ $buffer }));
    Handles[device].BufferAddresses.insert(deviceAddress, deviceAddress+BigInt(byteLength), $buffer);
    return deviceAddress; // conflict-less
}

//
const getAcceelerationStructureAddress = (device, accelerationStructure, byteLength = 1n)=>{
    const deviceAddress = V.vkGetAccelerationStructureDeviceAddressKHR(device, new V.VkAccelerationStructureDeviceAddressInfoKHR({ accelerationStructure }));
    Handles[device].AccelerationStructureAddresses.insert([parseInt(deviceAddress), parseInt(deviceAddress+byteLength)], accelerationStructure);
    return deviceAddress;
}





//
const awaitTick = ()=> new Promise(setImmediate);

//
const checkFence = (fence) => {
    return (fence && (Array.isArray(fence) || fence[0])) ? BigInt(fence[0]) : BigInt(fence || 0n);
}

//
const exchange = (arr, val, I = 0) => {
    const old = arr[I]; arr[I] = val; return old;
}

//
const awaitFenceGen = async function*(device, fence) {
    let status = V.VK_NOT_READY;
    let fenceX = checkFence(fence);
    do {
        await awaitTick(); yield status;
        if (status == V.VK_ERROR_DEVICE_LOST) { throw Error("Vulkan Device Lost"); break; };
        if (status != V.VK_NOT_READY) break;
        if (!(fenceX = checkFence(fence))) break;
    } while((status = V.vkGetFenceStatus(device[0]||device, checkFence(fence))) == V.VK_NOT_READY);
    return status;
}

//
const awaitFenceAsync = async (device, fence) => {
    let status = V.VK_NOT_READY;
    let fenceX = checkFence(fence);
    do {
        await awaitTick();
        if (status == V.VK_ERROR_DEVICE_LOST) { throw Error("Vulkan Device Lost"); break; };
        if (status != V.VK_NOT_READY) break;
        if (!(fenceX = checkFence(fence))) break;
    } while((status = V.vkGetFenceStatus(device[0]||device, checkFence(fence))) == V.VK_NOT_READY);
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
    awaitFenceGen,
    awaitFenceAsync,
    createShaderModule,
    getMemoryTypeIndex,
    createShaderModuleInfo,
    createTypedBuffer,
    createVertexBuffer,
    createInstanceBuffer,
    getBufferDeviceAddress,
    getAcceelerationStructureAddress,
    exchange
};
