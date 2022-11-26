import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class DeviceObj extends B.BasicObj {
    constructor(base, cInfo) {

        // TODO: full queue family with priorities support
        const queuePriorities = new Float32Array([1.0]);
        this.deviceQueueInfo = new V.VkDeviceQueueCreateInfo([{
            queueFamilyIndex: 0,
            queueCount: queuePriorities.length,
            pQueuePriorities: queuePriorities
        }]);

        //
        this.deviceLayers = [];
        this.deviceExtensions = ["VK_KHR_swapchain", "VK_KHR_acceleration_structure", "VK_KHR_deferred_host_operations", "VK_KHR_ray_query"];

        //
        V.vkCreateDevice(physicalDevice, this.deviceInfo = new V.VkDeviceCreateInfo({
            pNext: deviceFeatures,
            queueCreateInfoCount: this.deviceQueueInfo.length,
            pQueueCreateInfos: this.deviceQueueInfo,
            enabledExtensionCount: this.deviceExtensions.length,
            ppEnabledExtensionNames: this.deviceExtensions
        }), null, this.handle = new BigUint64Array(1));

        //
        B.Handles[this.handle[0]] = this;
    }

    getQueue(queueFamilyIndex, queueIndex = 0) {
        const queue = new BigUint64Array(1);
        V.vkGetDeviceQueue(device[0], queueFamilyIndex, 0, queue);
        return queue;
    }
}

//
export default DeviceObj;
