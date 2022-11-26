import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class SwapChainObj extends B.BasicObj {
    constructor(base, cInfo) {
        const physicalDeviceObj = B.Handles[cInfo.physicalDevice[0]];
        const surfaceInfo = physicalDeviceObj.getSurfaceInfo(cInfo.window.getSurface());


        // TODO: full support auto info
        this.pInfo = new V.VkSwapchainCreateInfoKHR({
            sType: V.VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR,
            surface: cInfo.window.getSurface(),
            minImageCount: 3,
            imageFormat: V.VK_FORMAT_B8G8R8A8_UNORM,
            imageColorSpace: V.VK_COLOR_SPACE_SRGB_NONLINEAR_KHR,
            ["imageExtent:u32[2]"]: cInfo.window.getWindowSize(),
            imageArrayLayers: 1,
            imageUsage: V.VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | V.VK_IMAGE_USAGE_STORAGE_BIT,
            imageSharingMode: V.VK_SHARING_MODE_EXCLUSIVE,
            queueFamilyIndexCount: cInfo.queueFamilyIndices.length,
            pQueueFamilyIndices: cInfo.queueFamilyIndices,
            preTransform: V.VK_SURFACE_TRANSFORM_IDENTITY_BIT_KHR,
            compositeAlpha: V.VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR,
            presentMode: V.VK_PRESENT_MODE_FIFO_KHR,
            clipped: V.VK_TRUE,
            oldSwapchain: null,
        });
    }
}
