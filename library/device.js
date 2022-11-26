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
        V.vkCreateDevice(physicalDevice, this.deviceInfo = new V.VkDeviceCreateInfo({
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
            Allocators: {}
        });
    }

    getQueue(queueFamilyIndex, queueIndex = 0) {
        const queue = new BigUint64Array(1);
        V.vkGetDeviceQueue(device[0], queueFamilyIndex, queueIndex, queue);
        return queue;
    }
}

//
B.DeviceObj = DeviceObj;
export default DeviceObj;
