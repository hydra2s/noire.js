import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";
import IntervalTree from '@flatten-js/interval-tree'

//
class DeviceObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null);

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
        this.deviceExtensions = [
            "VK_KHR_swapchain", 
            "VK_KHR_deferred_host_operations", 
            "VK_KHR_acceleration_structure", 
            "VK_KHR_ray_query", 
            "VK_EXT_conservative_rasterization", 
            "VK_EXT_extended_dynamic_state3",
            "VK_EXT_robustness2", 
            "VK_EXT_vertex_input_dynamic_state",
            "VK_EXT_descriptor_buffer", // needs termination code here
            "VK_EXT_multi_draw",
            "VK_KHR_fragment_shader_barycentric",
            "VK_EXT_mesh_shader",
            "VK_EXT_pipeline_robustness",
            "VK_EXT_shader_image_atomic_int64",
            "VK_EXT_shader_atomic_float",
            "VK_KHR_shader_clock",
            "VK_KHR_ray_tracing_maintenance1",
            "VK_KHR_workgroup_memory_explicit_layout",
            "VK_EXT_mutable_descriptor_type",
            "VK_EXT_transform_feedback",
            "VK_EXT_shader_atomic_float2" // broken support in NVIDIA
        ];

        //for (let K=0;K<physicalDeviceObj.extensions.length;K++) {
            //console.log(physicalDeviceObj.extensions[K].extensionName);
        //}

        //
        this.deviceExtensions = this.deviceExtensions.filter((E)=>{
            let found = false;
            for (let K=0;K<physicalDeviceObj.extensions.length;K++) {
                const X = String.fromAddress(physicalDeviceObj.extensions[K].extensionName.address());
                if (X == E) { found = true; break; };
            }
            return found;
        });

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
            AccelerationStructures: {},
            Images: {},
            Buffers: {},
            Memories: {},
            Allocators: {},
            Descriptors: {},
            SwapChains: {},
            Pipelines: {},
            ImageViews: {},
            Samplers: {},
            BufferAddresses: new IntervalTree.default(),
            AccelerationStructureAddresses: new IntervalTree.default()
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

    getBufferHandleByAddress(address) {
        return this.BufferAddresses.search([address, address])[0];
    }

    getAccelerationStructureHandleByAddress(address) {
        return this.AccelerationStructureAddresses.search([address, address])[0];
    }

    // TODO: pre-compute queues in families
    getQueue(queueFamilyIndex, queueIndex = 0) {
        const queue = new BigUint64Array(1);
        V.vkGetDeviceQueue(this.handle[0], queueFamilyIndex, queueIndex, queue);
        return queue;
    }

    createFramebuffer(cInfo) {
        return new B.FramebufferObj(this.handle, cInfo);
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
        return new (Type || B.MemoryAllocatorObj)(this.handle, cInfo);
    }

    createFramebufferLayout(cInfo) {
        return new B.FramebufferLayoutObj(this.handle, cInfo);
    }

    createImageView(cInfo) {
        return new B.ImageViewObj(this.handle, cInfo);
    }

    createSampler(cInfo) {
        return new B.SamplerObj(this.handle, cInfo);
    }

    // for once or temp ops
    tickProcessing() {
        this.destroyQueue.map((F)=>F());
        this.waitingProcesses.map((F)=>F());
    }

    //
    allocatePrimaryCommands(cmdBufFn, cmdCount = 1, queueFamilyIndex = 0) {
        // single time command
        const cmdBuf = new BigUint64Array(cmdCount);
        V.vkAllocateCommandBuffers(this.handle[0], new V.VkCommandBufferAllocateInfo({ commandPool: this.queueFamilies[queueFamilyIndex].cmdPool, level: V.VK_COMMAND_BUFFER_LEVEL_PRIMARY, commandBufferCount: cmdBuf.length }), cmdBuf);

        //
        for (let I=0;I<cmdCount;I++) { 
            V.vkBeginCommandBuffer(cmdBuf[I], new V.VkCommandBufferBeginInfo({ flags: V.VK_COMMAND_BUFFER_USAGE_SIMULTANEOUS_USE_BIT }));
            cmdBufFn(cmdBuf[I], I); 
            V.vkEndCommandBuffer(cmdBuf[I])
        };

        //
        return cmdBuf;
    }

    //
    submitCommands({cmdBuf = [], queueFamilyIndex = 0, queueIndex = 0, waitSemaphores = [], signalSemaphores = [], waitStageMasks = [], manualFence = false} = { cmdBuf: [], queueFamilyIndex: 0, queueIndex: 0, waitSemaphores: [], signalSemaphores: [] }) {
        // single time command
        const fence = new BigUint64Array(1);
        const queue = this.getQueue(queueFamilyIndex, queueIndex);

        // TODO: submit2 support
        V.vkCreateFence(this.handle[0], new V.VkFenceCreateInfo({ flags: 0 }), null, fence);
        V.vkQueueSubmit(queue[0], 1, new V.VkSubmitInfo({ 
            waitSemaphoreCount: waitSemaphores?.length || 0,
            pWaitSemaphores: waitSemaphores ? new BigUint64Array(waitSemaphores) : null,
            pWaitDstStageMask: new Uint32Array(waitStageMasks),
            commandBufferCount: cmdBuf.length,
            pCommandBuffers: cmdBuf,
            signalSemaphoreCount: signalSemaphores?.length || 0,
            pSignalSemaphores: signalSemaphores ? new BigUint64Array(signalSemaphores) : null,
        }), fence[0]);

        //
        const deallocProcess = ()=>{
            const result = V.vkGetFenceStatus(this.handle[0], fence[0]);
            if (result != V.VK_NOT_READY) {
                const index = this.waitingProcesses.indexOf(deallocProcess);
                if (index >= 0) this.waitingProcesses.splice(index, 1);
            };
            if (!manualFence && fence[0]) {
                V.vkDestroyFence(this.handle[0], fence[0], null); fence[0] = 0n;
            }
        };
        this.waitingProcesses.push(deallocProcess);

        //
        return fence;
    }

    //
    submitOnce({cmdBufFn = null, queueFamilyIndex = 0, queueIndex = 0, waitSemaphores = [], signalSemaphores = [], waitStageMasks = [], manualFence = false} = { cmdBufFn: null, queueFamilyIndex: 0, queueIndex: 0, waitSemaphores: [], signalSemaphores: [] }) {
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
        V.vkQueueSubmit(queue[0], 1, new V.VkSubmitInfo({
            waitSemaphoreCount: waitSemaphores?.length || 0,
            pWaitSemaphores: waitSemaphores ? new BigUint64Array(waitSemaphores) : null,
            pWaitDstStageMask: new Uint32Array(waitStageMasks),
            commandBufferCount: cmdBuf.length,
            pCommandBuffers: cmdBuf,
            signalSemaphoreCount: signalSemaphores?.length || 0,
            pSignalSemaphores: signalSemaphores ? new BigUint64Array(signalSemaphores) : null,
        }), fence[0]);

        //
        const deallocProcess = ()=>{
            const result = V.vkGetFenceStatus(this.handle[0], fence[0]);
            if (result != V.VK_NOT_READY) {
                V.vkFreeCommandBuffers(this.handle[0], this.queueFamilies[queueFamilyIndex].cmdPool, cmdBuf.length, cmdBuf);
                const index = this.waitingProcesses.indexOf(deallocProcess);
                if (index >= 0) this.waitingProcesses.splice(index, 1); 
            };
            if (!manualFence && fence[0]) {
                // BROKEN!
                V.vkDestroyFence(this.handle[0], fence[0], null); fence[0] = 0n;
            }
        };
        this.waitingProcesses.push(deallocProcess);

        //
        return fence;
    }
}

//
B.DeviceObj = DeviceObj;
export default DeviceObj;
