import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
const presentModes = [V.VK_PRESENT_MODE_IMMEDIATE_KHR, V.VK_PRESENT_MODE_FIFO_RELAXED_KHR, V.VK_PRESENT_MODE_FIFO_KHR, V.VK_PRESENT_MODE_MAILBOX_KHR];
const surfaceFormats = [V.VK_FORMAT_A2B10G10R10_UNORM_PACK32, V.VK_FORMAT_B8G8R8A8_UNORM];

//
class SwapChainObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[(this.cInfo?.physicalDevice ? this.cInfo?.physicalDevice[0] : null) || this.cInfo?.physicalDevice || deviceObj.base[0]];
        const surfaceInfo = physicalDeviceObj.getSurfaceInfo(this.cInfo.window.getSurface());
        const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];

        //
        let presentMode = presentModes[0];
        for (let PM of presentModes) {
            if (Array.from(surfaceInfo.presentModes).indexOf(PM) >= 0) {
                presentMode = PM; break;
            }
        }

        //
        let format = surfaceFormats[0];
        let colorSpace = V.VK_COLOR_SPACE_SRGB_NONLINEAR_KHR;

        //
        for (let F of surfaceFormats) {
            const ID = Array.from(surfaceInfo.formats2).findIndex((F2)=>(F2.surfaceFormat.format == format));
            if (ID >= 0) {
                format = surfaceInfo.formats2[ID].surfaceFormat.format; 
                colorSpace = surfaceInfo.formats2[ID].surfaceFormat.colorSpace;
                break;
            }
        }

        // TODO: full support auto info
        this.pInfo = new V.VkSwapchainCreateInfoKHR({
            sType: V.VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR,
            surface: this.cInfo.window.getSurface(),
            minImageCount: surfaceInfo.surfaceCapabilities.maxImageCount,  // needs get info
            imageFormat: format, // needs get info
            imageColorSpace: colorSpace,  // needs get info
            ["imageExtent:u32[2]"]: this.cInfo.window.getWindowSize(),
            imageArrayLayers: 1,
            imageUsage: V.VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | V.VK_IMAGE_USAGE_STORAGE_BIT | V.VK_IMAGE_USAGE_TRANSFER_SRC_BIT | V.VK_IMAGE_USAGE_TRANSFER_DST_BIT,
            imageSharingMode: V.VK_SHARING_MODE_EXCLUSIVE,
            queueFamilyIndexCount: this.cInfo.queueFamilyIndices?.length || 0,
            pQueueFamilyIndices: this.cInfo.queueFamilyIndices,
            preTransform: surfaceInfo.surfaceCapabilities.currentTransform,
            compositeAlpha: surfaceInfo.surfaceCapabilities.supportedCompositeAlpha,
            presentMode: presentMode,
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
            imageViewObj.DSC_ID = descriptorsObj.storageImages.push(this.imageViews[I]);

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
                dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,
                newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                image: this.swapchainImages[I],
                subresourceRange: this.imageViewInfo.subresourceRange
            };

            //
            this.imageTransitionBarrierForPresent[I] = {
                srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
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
        descriptorsObj.writeDescriptors();

        //
        deviceObj.SwapChains[this.handle[0]] = this;

        //
        this.semaphoreImageAvailable = new BigUint64Array(1); 
        this.semaphoreRenderingAvailable = new BigUint64Array(1);
        this.semaphoreInfo = new V.VkSemaphoreCreateInfo({});
        this.imageIndex = new Uint32Array([0]);
        V.vkCreateSemaphore(this.base[0], this.semaphoreInfo, null, this.semaphoreImageAvailable);
        V.vkCreateSemaphore(this.base[0], this.semaphoreInfo, null, this.semaphoreRenderingAvailable);
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
    getFormat() { return this.pInfo.imageFormat; }
    getImageCount() { return this.swapchainImages.length; }
    getColorSpace() { return this.pInfo.imageColorSpace; }
    getImages() { return this.swapchainImages; }
    getImageViews() { return this.imageViews; }
    getImage(index = 0) { return this.swapchainImages[index]; }
    getImageView(index = 0) { return this.imageViews[index]; }
    getCurrentImage() { return this.swapchainImages[this.imageIndex[0]]; }
    getCurrentImageView() { return this.imageViews[this.imageIndex[0]]; }

    //
    getStorageDescId(index = 0) {
        const deviceObj = B.Handles[this.base[0]];
        const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];
        return deviceObj.ImageViews[this.imageViews[index]].DSC_ID;
    }

    // 
    acquireImageIndex(semaphoreImageAvailable = null) {
        V.vkAcquireNextImageKHR(this.base[0], this.handle[0], BigInt(Number.MAX_SAFE_INTEGER), semaphoreImageAvailable || this.semaphoreImageAvailable[0], 0n, this.imageIndex);
        return this.imageIndex[0];
    }

    // 
    present({queue, semaphoreRenderingAvailable = null}) {
        V.vkQueuePresentKHR(queue[0] || queue, new V.VkPresentInfoKHR({
            waitSemaphoreCount: semaphoreRenderingAvailable?.length || this.semaphoreRenderingAvailable.length,
            pWaitSemaphores: semaphoreRenderingAvailable && semaphoreRenderingAvailable.length ? new BigUint64Array(semaphoreRenderingAvailable) : this.semaphoreRenderingAvailable,
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
