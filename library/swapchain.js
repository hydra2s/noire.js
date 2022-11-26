import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class SwapChainObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[(this.cInfo?.physicalDevice ? this.cInfo?.physicalDevice[0] : null) || this.cInfo?.physicalDevice || deviceObj.base[0]];
        const surfaceInfo = physicalDeviceObj.getSurfaceInfo(this.cInfo.window.getSurface());

        // TODO: full support auto info
        this.pInfo = new V.VkSwapchainCreateInfoKHR({
            sType: V.VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR,
            surface: this.cInfo.window.getSurface(),
            minImageCount: 3,  // needs get info
            imageFormat: V.VK_FORMAT_B8G8R8A8_UNORM, // needs get info
            imageColorSpace: V.VK_COLOR_SPACE_SRGB_NONLINEAR_KHR,  // needs get info
            ["imageExtent:u32[2]"]: this.cInfo.window.getWindowSize(),
            imageArrayLayers: 1,
            imageUsage: V.VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | V.VK_IMAGE_USAGE_STORAGE_BIT | V.VK_IMAGE_USAGE_TRANSFER_SRC_BIT | V.VK_IMAGE_USAGE_TRANSFER_DST_BIT,
            imageSharingMode: V.VK_SHARING_MODE_EXCLUSIVE,
            queueFamilyIndexCount: this.cInfo.queueFamilyIndices?.length || 0,
            pQueueFamilyIndices: this.cInfo.queueFamilyIndices,
            preTransform: V.VK_SURFACE_TRANSFORM_IDENTITY_BIT_KHR,
            compositeAlpha: V.VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR,
            presentMode: V.VK_PRESENT_MODE_FIFO_KHR,  // needs get info
            clipped: V.VK_TRUE,
            oldSwapchain: null,
        });

        //
        V.vkCreateSwapchainKHR(this.base[0], this.pInfo, null, this.handle = new BigUint64Array(1));
        V.vkGetSwapchainImagesKHR(this.base[0], this.handle[0], this.amountOfImagesInSwapchain = new Uint32Array(1), null);
        V.vkGetSwapchainImagesKHR(this.base[0], this.handle[0], this.amountOfImagesInSwapchain, this.swapchainImages = new BigUint64Array(this.amountOfImagesInSwapchain[0]));

        //
        this.imageViewInfo = new V.VkImageViewCreateInfo({
            sType : V.VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO,
            viewType : V.VK_IMAGE_VIEW_TYPE_2D,
            format : this.pInfo.imageFormat,
            subresourceRange: { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: 1, baseArrayLayer: 0, layerCount: this.pInfo.imageArrayLayers },
        });


        // TODO: make general based
        // moooo, korovka...
        this.imageViews = new BigUint64Array(this.amountOfImagesInSwapchain[0]);
        this.imageTransitionBarrierForPresent = new V.VkImageMemoryBarrier2(this.imageViews.length);
        this.imageTransitionBarrierForGeneral = new V.VkImageMemoryBarrier2(this.imageViews.length);
        this.imageTransitionBarrierFromUndefined = new V.VkImageMemoryBarrier2(this.imageViews.length);

        //
        for (let I=0;I<this.amountOfImagesInSwapchain[0];I++) {
            V.vkCreateImageView(this.base[0], this.imageViewInfo.set({image: this.swapchainImages[I]}), null, this.imageViews.addressOffsetOf(I)); // bit-tricky by device address
            const imageObj = new B.ImageObj(this.base, null); imageObj.handle = new BigUint64Array([this.swapchainImages[I]]); deviceObj.Images[imageObj.handle[0]] = imageObj;
            const imageViewObj = new B.ImageViewObj(this.base, null); imageViewObj.handle = new BigUint64Array([this.imageViews[I]]); deviceObj.ImageViews[imageViewObj.handle[0]] = imageViewObj;

            //
            imageViewObj.cInfo = { image: this.swapchainImages[I], subresourceRange: this.imageViewInfo.subresourceRange };
            imageViewObj.imageViewInfo = this.imageViewInfo.set({image: this.swapchainImages[I]}).serialize();

            //
            this.imageTransitionBarrierFromUndefined[I] = {
                srcStageMask: V.VK_PIPELINE_STAGE_2_NONE,
                srcAccessMask: V.VK_ACCESS_2_NONE,
                dstStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
                dstAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
                newLayout: V.VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,
                image: this.swapchainImages[I],
                subresourceRange: this.imageViewInfo.subresourceRange
            };

            //
            this.imageTransitionBarrierForGeneral[I] = {
                srcStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
                srcAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
                dstStageMask: V.VK_PIPELINE_STAGE_2_FRAGMENT_SHADER_BIT,
                dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,
                newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                image: this.swapchainImages[I],
                subresourceRange: this.imageViewInfo.subresourceRange
            };

            //
            this.imageTransitionBarrierForPresent[I] = {
                srcStageMask: V.VK_PIPELINE_STAGE_2_FRAGMENT_SHADER_BIT,
                srcAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                dstStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
                dstAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                newLayout: V.VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,
                image: this.swapchainImages[I],
                subresourceRange: this.imageViewInfo.subresourceRange
            };
        }

        //
        deviceObj.SwapChains[this.handle[0]] = this;

        //
        this.semaphoreImageAvailable = new BigUint64Array(1); 
        this.semaphoreRenderingAvailable = new BigUint64Array(1);
        this.semaphoreInfo = new V.VkSemaphoreCreateInfo({});
        this.imageIndex = new Uint32Array([0]);
        V.vkCreateSemaphore(this.base[0], this.semaphoreInfo, null, this.semaphoreImageAvailable);
        V.vkCreateSemaphore(this.base[0], this.semaphoreInfo, null, this.semaphoreRenderingAvailable);

        //
        
    }

    //
    cmdFromUndefined(cmdBuf) {
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: this.imageTransitionBarrierFromUndefined.length, pImageMemoryBarriers: this.imageTransitionBarrierFromUndefined }));
    }

    //
    cmdToGeneral(cmdBuf) {
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: this.imageTransitionBarrierForGeneral.length, pImageMemoryBarriers: this.imageTransitionBarrierForGeneral }));
    }

    //
    cmdToPresent(cmdBuf) {
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: this.imageTransitionBarrierForPresent.length, pImageMemoryBarriers: this.imageTransitionBarrierForPresent }));
    }

    //
    getImageCount() {
        return this.swapchainImages.length;
    }

    //
    getCurrentImage() {
        return this.swapchainImages[this.imageIndex[0]];
    }

    //
    getCurrentImageView() {
        return this.imageViews[this.imageIndex[0]];
    }

    // TODO: dedicated semaphores support
    acquireImageIndex() {
        V.vkAcquireNextImageKHR(this.base[0], this.handle[0], BigInt(Number.MAX_SAFE_INTEGER), this.semaphoreImageAvailable[0], 0n, this.imageIndex);
        return this.imageIndex[0];
    }

    // TODO: dedicated semaphores support
    present({queue}) {
        V.vkQueuePresentKHR(queue[0] || queue, new V.VkPresentInfoKHR({
            waitSemaphoreCount: this.semaphoreRenderingAvailable.length,
            pWaitSemaphores: this.semaphoreRenderingAvailable,
            swapchainCount: this.handle.length,
            pSwapchains: this.handle,
            pImageIndices: this.imageIndex,
            pResults: null,
        }));
    }
}

//
B.SwapChainObj = SwapChainObj;
export default SwapChainObj;
