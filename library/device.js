import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class DeviceObj extends B.BasicObj {
    constructor(base, cInfo) {
        //
        const physicalDeviceObj = B.Handles[this.base[0]];
        const instanceObj = B.Handles[physicalDeviceObj.base[0]];

        // 
        this.deviceQueueInfo = new V.VkDeviceQueueCreateInfo(new Array(cInfo.queueFamilies.length).fill({}).map((_, I)=>({
            queueFamilyIndex: cInfo.queueFamilies[I].index,
            queueCount: cInfo.queueFamilies[I].queuePriorities.length,
            pQueuePriorities: new Float32Array(cInfo.queueFamilies[I].queuePriorities),
        })));

        //
        this.deviceLayers = [];
        this.deviceExtensions = ["VK_KHR_swapchain", "VK_KHR_acceleration_structure", "VK_KHR_deferred_host_operations", "VK_KHR_ray_query"];

        //
        V.vkCreateDevice(this.base[0], this.deviceInfo = new V.VkDeviceCreateInfo({
            pNext: physicalDeviceObj.deviceFeatures,
            queueCreateInfoCount: this.deviceQueueInfo.length,
            pQueueCreateInfos: this.deviceQueueInfo,
            enabledExtensionCount: this.deviceExtensions.length,
            ppEnabledExtensionNames: this.deviceExtensions
        }), null, this.handle = new BigUint64Array(1));

        //
        B.Handles[this.handle[0]] = this;

        //
        Object.assign(this, {
            Images: {},
            Buffers: {},
            Memories: {},
            Allocators: {},
            Descriptors: {},
            SwapChains: {},
            Pipelines: {}
        });

        //
        this.destroyQueue = [];
        this.waitingProcesses = [];

        // TODO: pre-got queues
        this.queueFamilyIndices = new Uint32Array(cInfo.queueFamilies.length);
        this.queueFamilies = {};
        cInfo.queueFamilies.map((F,I)=>{
            this.queueFamilyIndices[I] = F.index;
            this.queueFamilies[F.index] = {
                queuePriorities: cInfo.queueFamilies[I].queuePriorities
            };
        });

        //
        this.cmdPools = new BigUint64Array(this.queueFamilyIndices.length);
        let N = 0; for (let I of this.queueFamilyIndices) {
            V.vkCreateCommandPool(this.handle[0], new V.VkCommandPoolCreateInfo({
                pNext: null,
                queueFamilyIndex: I
            }), null, this.cmdPools.addressOffsetOf(N));
            this.queueFamilies[I].cmdPool = this.cmdPools[N++];
        }
    }

    // TODO: pre-compute queues in families
    getQueue(queueFamilyIndex, queueIndex = 0) {
        const queue = new BigUint64Array(1);
        V.vkGetDeviceQueue(device[0], queueFamilyIndex, queueIndex, queue);
        return queue;
    }

    createTopLevelAccelerationStructure(cInfo) {
        return new B.TopLevelAccelerationStructure(this.handle, cInfo);
    }

    createBottomLevelAccelerationStructure(cInfo) {
        return new B.BottomLevelAccelerationStructure(this.handle, cInfo);
    }

    createImage(cInfo) {
        return new B.ImageObj(this.handle, cInfo);
    }

    createComputePipeline(cInfo) {
        return new B.ComputePipelineObj(this.handle, cInfo);
    }

    createGraphicsPipeline(cInfo) {
        return new B.GraphicsPipelineObj(this.handle, cInfo);
    }

    createBuffer(cInfo) {
        return new B.BufferObj(this.handle, cInfo);
    }

    createSwapChain(cInfo) {
        return new B.SwapChainObj(this.handle, cInfo);
    }

    createDescriptors(cInfo) {
        return new B.DescriptorsObj(this.handle, cInfo);
    }

    createDeviceMemory(cInfo) {
        return new B.DeviceMemoryObj(this.handle, cInfo);
    }

    createMemoryAllocator(cInfo, Type = B.MemoryAllocator) {
        return new (Type || B.MemoryAllocator)(this.handle, cInfo);
    }

    // for once or temp ops
    tickProcessing() {
        this.destroyQueue.map((F)=>F());
        this.waitingProcesses.map((F)=>F());
    }

    //
    submitCommands({cmdBuf = [], queueFamilyIndex = 0, queueIndex = 0, waitSemaphores = [], signalSemaphores = []} = { cmdBuf: [], queueFamilyIndex: 0, queueIndex: 0, waitSemaphores: [], signalSemaphores: [] }) {
        // single time command
        const fence = new BigUint64Array(1);
        const queue = this.getQueue(queueFamilyIndex, queueIndex);

        // TODO: submit2 support
        V.vkCreateFence(this.handle[0], new V.VkFenceCreateInfo({ flags: 0 }), null, fence);
        V.vkQueueSubmit(queue[0], 1, new V.VkSubmitInfo({ commandBufferCount: cmdBuf.length, pCommandBuffers: cmdBuf }), fence);

        //
        const deallocProcess = ()=>{
            const result = V.vkGetFenceStatus(this.handle[0], fence[0]);
            if (result != V.VK_NOT_READY) {
                this.waitingProcesses.splice(this.waitingProcesses.indexOf(deallocProcess), 1); 
            };
            V.vkDestroyFence(this.handle[0], fence[0], null);
        };
        this.waitingProcesses.push(deallocProcess);

        //
        return fence;
    }

    //
    submitOnce({cmdBufFn = null, queueFamilyIndex = 0, queueIndex = 0, waitSemaphores = [], signalSemaphores = []} = { cmdBufFn: null, queueFamilyIndex: 0, queueIndex: 0, waitSemaphores: [], signalSemaphores: [] }) {
        // single time command
        const fence = new BigUint64Array(1), cmdBuf = new BigUint64Array(1);
        const queue = this.getQueue(queueFamilyIndex, queueIndex);

        //
        V.vkAllocateCommandBuffers(this.handle[0], new V.VkCommandBufferAllocateInfo({ commandPool: this.queueFamilies[queueFamilyIndex].cmdPool, level: V.VK_COMMAND_BUFFER_LEVEL_PRIMARY, commandBufferCount: cmdBuf.length }), cmdBuf);
        V.vkBeginCommandBuffer(cmdBuf[0], new V.VkCommandBufferBeginInfo({ flags: V.VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT }));
        cmdBufFn(cmdBuf[0]);
        V.vkEndCommandBuffer(cmdBuf[0]);

        // TODO: submit2 support
        V.vkCreateFence(this.handle[0], new V.VkFenceCreateInfo({ flags: 0 }), null, fence);
        V.vkQueueSubmit(queue[0], 1, new V.VkSubmitInfo({ commandBufferCount: cmdBuf.length, pCommandBuffers: cmdBuf }), fence);

        //
        const deallocProcess = ()=>{
            const result = V.vkGetFenceStatus(this.handle[0], fence[0]);
            if (result != V.VK_NOT_READY) {
                this.waitingProcesses.splice(this.waitingProcesses.indexOf(deallocProcess), 1); 
            };
            V.vkDestroyFence(this.handle[0], fence[0], null);
            V.vkFreeCommandBuffers(this.handle[0], this.queueFamilies[queueFamilyIndex].cmdPool, cmdBuf.length, cmdBuf);
        };
        this.waitingProcesses.push(deallocProcess);

        //
        return fence;
    }
}

//
B.DeviceObj = DeviceObj;
export default DeviceObj;
