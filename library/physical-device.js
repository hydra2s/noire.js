import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class PhysicalDeviceObj extends B.BasicObj {
    constructor(base, handle) {
        super(base, handle);
        const instanceObj = B.Handles[base[0]];

        //
        this.deviceVertexInputFeatures = new V.VkPhysicalDeviceVertexInputDynamicStateFeaturesEXT({});
        this.deviceRobustness2Features = new V.VkPhysicalDeviceRobustness2FeaturesEXT({ pNext: this.deviceVertexInputFeatures });
        this.deviceRayQueryFeatures = new V.VkPhysicalDeviceRayQueryFeaturesKHR({ pNext: this.deviceRobustness2Features });
        this.deviceAccelerationStructureFeaturs = new V.VkPhysicalDeviceAccelerationStructureFeaturesKHR({pNext: this.deviceRayQueryFeatures});
        this.deviceFeatures11 = new V.VkPhysicalDeviceVulkan11Features({pNext: this.deviceAccelerationStructureFeaturs});
        this.deviceFeatures12 = new V.VkPhysicalDeviceVulkan12Features({pNext: this.deviceFeatures11});
        this.deviceFeatures13 = new V.VkPhysicalDeviceVulkan13Features({pNext: this.deviceFeatures12});
        this.deviceFeatures = new V.VkPhysicalDeviceFeatures2({pNext: this.deviceFeatures13});
        this.deviceProperties = new V.VkPhysicalDeviceProperties2();

        //
        V.vkGetPhysicalDeviceProperties2(this.handle[0], this.deviceProperties);
        V.vkGetPhysicalDeviceFeatures2(this.handle[0], this.deviceFeatures);

        //
        V.vkGetPhysicalDeviceQueueFamilyProperties(this.handle[0], this.queueFamilyCount = new Uint32Array(1), null);
        V.vkGetPhysicalDeviceQueueFamilyProperties(this.handle[0], this.queueFamilyCount, this.queueFamilyProperties = new V.VkQueueFamilyProperties(this.queueFamilyCount[0]));

        //
        V.vkEnumerateDeviceExtensionProperties(this.handle[0], V.AsBigInt(""), this.extensionCount = new Uint32Array(1), null);
        V.vkEnumerateDeviceExtensionProperties(this.handle[0], V.AsBigInt(""), this.extensionCount, this.extensions = new V.VkExtensionProperties(this.extensionCount[0]));

        //
        B.Handles[this.handle[0]] = this;
    }

    createDevice(cInfo) {
        return new B.DeviceObj(this.handle, cInfo);
    }

    getSurfaceInfo(surface) {
        let surf = { surface, presentModeCount: new Uint32Array(1), presentModes: [], surfaceSupport: [0] };

        //
        V.vkGetPhysicalDeviceSurfaceSupportKHR(this.handle[0], 0, surf.surface, surf.surfaceSupport = new Uint32Array([0]));
        console.log("Surface Support By Physical Device: " + surf.surfaceSupport);

        // if supported, get info
        if (surf.surfaceSupport[0]) {
            V.vkGetPhysicalDeviceSurfaceCapabilities2KHR(this.handle[0], new V.VkPhysicalDeviceSurfaceInfo2KHR({ surface }), surf.surfaceCapabilities2 = new V.VkSurfaceCapabilities2KHR({}));
            V.vkGetPhysicalDeviceSurfacePresentModesKHR(this.handle[0], surf.surface, surf.presentModeCount, null);
            V.vkGetPhysicalDeviceSurfacePresentModesKHR(this.handle[0], surf.surface, surf.presentModeCount, surf.presentModes = new Int32Array(surf.presentModeCount[0]));
            V.vkGetPhysicalDeviceSurfaceFormats2KHR(this.handle[0], new V.VkPhysicalDeviceSurfaceInfo2KHR({ surface }), surf.formatCount = new Uint32Array(1), null);
            V.vkGetPhysicalDeviceSurfaceFormats2KHR(this.handle[0], new V.VkPhysicalDeviceSurfaceInfo2KHR({ surface }), surf.formatCount, surf.formats2 = new V.VkSurfaceFormat2KHR(surf.formatCount[0]));

            //
            surf.surfaceCapabilities = surf.surfaceCapabilities2.surfaceCapabilities;
        }

        return surf;
    }

    searchQueueFamilyIndex(bits) {
        let queueIndex = -1;
        for (let I=0;I<this.queueFamilyCount[0];I++) {
            if (this.queueFamilyProperties[I].queueFlags & bits) {
                queueIndex = I; break;
            }
        }
        return queueIndex;
    }
}

//
B.PhysicalDeviceObj = PhysicalDeviceObj;
export default PhysicalDeviceObj;
