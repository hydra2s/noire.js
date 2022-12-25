import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class MemoryAllocatorObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.Memories = {};
        this.handle = new BigUint64Array([0n]);
        this.handle[0] = this.handle.address();
        B.Handles[this.handle[0]] = this;
    }

    allocateMemory(cInfo, allocationObj = null) {
        //
        if (allocationObj) {
            cInfo.memoryRequirements2 = allocationObj.memoryRequirements2;
            cInfo.memoryRequirements = allocationObj.memoryRequirements;
            cInfo.isImage  = allocationObj.isImage  ? allocationObj.handle[0] : 0n;
            cInfo.isBuffer = allocationObj.isBuffer ? allocationObj.handle[0] : 0n;
        }

        //
        const deviceMemory = new DeviceMemoryObj(this.handle, cInfo);
        const memoryOffset = 0n; // TODO: support for allocation offsets and VMA

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        B.Handles[this.handle[0]] = this;
        deviceObj.Allocators[this.handle[0]] = this;

        //
        if (allocationObj) {
            allocationObj.memoryOffset = memoryOffset;
            allocationObj.deviceMemory = deviceMemory.handle;
        }

        //
        if (allocationObj?.isBuffer) {
            V.vkBindBufferMemory(deviceObj.handle[0], allocationObj.handle[0], deviceMemory.handle[0], memoryOffset);
        } else
        if (allocationObj?.isImage) {
            V.vkBindImageMemory(deviceObj.handle[0], allocationObj.handle[0], deviceMemory.handle[0], memoryOffset);
        }

        //
        this.Memories[deviceMemory.handle[0]] = deviceMemory;
        deviceObj.Memories[deviceMemory.handle[0]] = deviceMemory;
        deviceMemory.Allocations[memoryOffset] = allocationObj;

        //
        return allocationObj;
    }
}

//
class DeviceMemoryObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.Allocations = {};

        //
        const memoryAllocatorObj = B.Handles[this.base[0]];
        const deviceObj = B.Handles[memoryAllocatorObj.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        const isBAR = (cInfo.isHost && cInfo.isDevice);
        const hostBased = (cInfo.isHost && !cInfo.isDevice);
        const propertyFlag = isBAR ? (
            V.VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT|
            V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT|
            V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT
        ) : (hostBased ? 
        (
            V.VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT |
            V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT |
            V.VK_MEMORY_PROPERTY_HOST_CACHED_BIT
        ) : V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);

        //
        let memoryTypeIndex = B.getMemoryTypeIndex(physicalDeviceObj.handle[0], cInfo.memoryRequirements.memoryTypeBits, propertyFlag, hostBased ? V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT : 0, cInfo.memoryRequirements.size);

        // host memory fallback (but FPS will drop), especially due for budget end
        if (memoryTypeIndex < 0) { 
            memoryTypeIndex = B.getMemoryTypeIndex(physicalDeviceObj.handle[0], cInfo.memoryRequirements.memoryTypeBits, 
                (isBAR ? true : !hostBased) ? 
                (
                    V.VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT |
                    V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT |
                    V.VK_MEMORY_PROPERTY_HOST_CACHED_BIT
                ) : V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,
                0,
                cInfo.memoryRequirements.size
            );
        };

        //
        V.vkAllocateMemory(deviceObj.handle[0], this.allocInfo = new V.VkMemoryAllocateInfo({
            pNext: new V.VkMemoryAllocateFlagsInfo({
                pNext: new V.VkMemoryDedicatedAllocateInfo({
                    image : cInfo.isImage,
                    $buffer: cInfo.isBuffer
                }),
                flags: cInfo.isBuffer ? V.VK_MEMORY_ALLOCATE_DEVICE_ADDRESS_BIT_KHR : 0
            }),
            allocationSize: cInfo.memoryRequirements.size,
            memoryTypeIndex
        }), null, this.handle = new BigUint64Array(1));
    }

    map(byteLength = 0n, byteOffset = 0n) {
        const memoryAllocatorObj = B.Handles[this.base[0]];
        //const deviceObj = B.Handles[memoryAllocatorObj.base[0]];
        //const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        const dataPtr = new BigUint64Array(1);
        V.vkMapMemory(memoryAllocatorObj.base[0], this.handle[0], BigInt(byteOffset), BigInt(byteLength) || BigInt(this.allocInfo.allocationSize), 0, dataPtr);
        return ArrayBuffer.fromAddress(dataPtr[0], parseInt(BigInt(byteLength) || BigInt(this.allocInfo.allocationSize)));
    }

    unmap() {
        const memoryAllocatorObj = B.Handles[this.base[0]];
        //const deviceObj = B.Handles[memoryAllocatorObj.base[0]];
        //const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        V.vkUnmapMemory(memoryAllocatorObj.base[0], this.handle[0]);
    }
}

//
class AllocationObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.memoryOffset = 0n;
        this.deviceMemory = null;
    }

    map(byteLength = 0, byteOffset = 0) {
        const deviceObj = B.Handles[this.base[0]];
        const deviceMemoryObj = deviceObj.Memories[this.deviceMemory[0]];

        return deviceMemoryObj.map(BigInt(byteLength), BigInt(this.memoryOffset) + BigInt(byteOffset));
    }

    unmap() {
        const deviceObj = B.Handles[this.base[0]];
        const deviceMemoryObj = deviceObj.Memories[this.deviceMemory[0]];
        deviceMemoryObj.unmap();
    }
}

// 
class BufferObj extends AllocationObj {
    constructor(base, cInfo) {
        super(base, cInfo);
        this.isBuffer = true;

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        // TODO: support for external memory allocators
        V.vkCreateBuffer(this.base[0], this.pInfo = new V.VkBufferCreateInfo({
            size: cInfo.byteSize || cInfo.byteLength || cInfo.size,
            usage: (cInfo.usage || 0) | V.VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT | V.VK_BUFFER_USAGE_TRANSFER_SRC_BIT | V.VK_BUFFER_USAGE_TRANSFER_DST_BIT,
            sharingMode: V.VK_SHARING_MODE_EXCLUSIVE,
            queueFamilyIndexCount: cInfo.queueFamilyIndices?.length || 0,
            pQueueFamilyIndices: cInfo.queueFamilyIndices
        }), null, this.handle = new BigUint64Array(1));
        deviceObj.Buffers[this.handle[0]] = this;

        //
        V.vkGetBufferMemoryRequirements2(this.base[0], new V.VkBufferMemoryRequirementsInfo2({ $buffer: this.handle[0] }), this.memoryRequirements2 = new V.VkMemoryRequirements2());
        this.memoryRequirements = this.memoryRequirements2.memoryRequirements;
    }

    getDeviceAddress() {
        return this.deviceAddress || (this.deviceAddress = B.getBufferDeviceAddress(this.base[0], this.handle[0], this.pInfo.size));
    }

    cmdCopyFromImage(cmdBuf, image, regions, imageLayout = V.VK_IMAGE_LAYOUT_GENERAL) {
        //
        const memoryBarrierTemplate = { 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
            srcAccessMask: 0,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // TODO: single object support
        const regionsCp = new V.VkBufferImageCopy2(regions.length);
        const srcMemoryBarrier = new V.VkImageMemoryBarrier2(regions.length);
        const dstMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        for (let I=0;I<regions.length;I++) {
            regionsCp[I] = {bufferOffset: 0, bufferRowLength: 0, bufferImageHeight: 0, imageOffset: {x:0,y:0,z:0}, imageExtent:{width:1,height:1,depth:1}, imageSubresource:{aspectMask:V.VK_IMAGE_ASPECT_COLOR_BIT,mipLevel:0,baseArrayLayer:0,layerCount:1}, ...(regions[I].serialize ? regions[I].serialize() : regions[I])};
            dstMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT, $buffer: this.handle[0], offset: regionsCp[I].bufferOffset, size: ~0n, };
            srcMemoryBarrier[I] = {...memoryBarrierTemplate, 
                srcAccessMask: V.VK_ACCESS_2_TRANSFER_READ_BIT, 
                image: image[0] || image, 
                subresourceRange: {aspectMask: regionsCp[I].imageSubresource.aspectMask, baseMipLevel: regionsCp[I].imageSubresource.mipLevel, levelCount: 1, baseArrayLayer: regionsCp[I].imageSubresource.baseArrayLayer, layerCount: regionsCp[I].imageSubresource.layerCount}, 
                oldLayout: imageLayout, 
                newLayout: imageLayout
            };
        }

        // TODO: needs or no pre-barrier?
        V.vkCmdCopyImageToBuffer2(cmdBuf[0]||cmdBuf, new V.VkCopyImageToBufferInfo2({
            srcImage: image[0] || image, 
            srcImageLayout: imageLayout,
            dstBuffer: this.handle[0],
            regionCount: regionsCp.length,
            pRegions: regionsCp
        }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: srcMemoryBarrier.length, pImageMemoryBarriers: srcMemoryBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: dstMemoryBarrier.length, pBufferMemoryBarriers: dstMemoryBarrier }));
    }

    cmdCopyToImage(cmdBuf, image, regions, imageLayout = V.VK_IMAGE_LAYOUT_GENERAL) {
        //
        const memoryBarrierTemplate = { 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
            srcAccessMask: 0,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // TODO: single object support
        const regionsCp = new V.VkBufferImageCopy2(regions.length);
        const srcMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        const dstMemoryBarrier = new V.VkImageMemoryBarrier2(regions.length);
        for (let I=0;I<regions.length;I++) {
            regionsCp[I] = {bufferOffset: 0, bufferRowLength: 0, bufferImageHeight: 0, imageOffset: {x:0,y:0,z:0}, imageExtent:{width:1,height:1,depth:1}, imageSubresource:{aspectMask:V.VK_IMAGE_ASPECT_COLOR_BIT,mipLevel:0,baseArrayLayer:0,layerCount:1}, ...(regions[I].serialize ? regions[I].serialize() : regions[I])};
            srcMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_READ_BIT , $buffer: this.handle[0], offset: regionsCp[I].bufferOffset, size: ~0n },
            dstMemoryBarrier[I] = {...memoryBarrierTemplate, 
                srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT, 
                image: image[0] || image, 
                subresourceRange: {aspectMask: regionsCp[I].imageSubresource.aspectMask, baseMipLevel: regionsCp[I].imageSubresource.mipLevel, levelCount: 1, baseArrayLayer: regionsCp[I].imageSubresource.baseArrayLayer, layerCount: regionsCp[I].imageSubresource.layerCount}, 
                oldLayout: imageLayout, 
                newLayout: imageLayout
            }
        }

        // TODO: needs or no pre-barrier?
        V.vkCmdCopyBufferToImage2(cmdBuf[0]||cmdBuf, new V.VkCopyBufferToImageInfo2({
            srcBuffer: this.handle[0],
            dstImage: image[0] || image, 
            dstImageLayout: imageLayout,
            regionCount: regionsCp.length,
            pRegions: regionsCp
        }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: srcMemoryBarrier.length, pBufferMemoryBarriers: srcMemoryBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: dstMemoryBarrier.length, pImageMemoryBarriers: dstMemoryBarrier }));
    }

    cmdCopyToBuffer(cmdBuf, buffer, regions) {
        //
        const memoryBarrierTemplate = { 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
            srcAccessMask: 0,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // TODO: single object support
        const regionsCp = new V.VkBufferCopy2(regions.length);
        const srcMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        const dstMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        for (let I=0;I<regions.length;I++) {
            regionsCp[I] = {srcOffset: 0, dstOffset: 0, size: ~0n, ...(regions[I].serialize ? regions[I].serialize() : regions[I])};
            srcMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_READ_BIT , $buffer: this.handle[0], offset: regionsCp[I].srcOffset, size: regionsCp[I].size },
            dstMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT, $buffer: buffer[0] || buffer, offset: regionsCp[I].dstOffset, size: regionsCp[I].size }
        }

        //
        V.vkCmdCopyBuffer2(cmdBuf[0]||cmdBuf, new V.VkCopyBufferInfo2({
            srcBuffer: this.handle[0],
            dstBuffer: buffer[0] || buffer, 
            regionCount: regionsCp.length,
            pRegions: regionsCp
        }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: srcMemoryBarrier.length, pBufferMemoryBarriers: srcMemoryBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: dstMemoryBarrier.length, pBufferMemoryBarriers: dstMemoryBarrier }));
    }

    cmdCopyFromBuffer(cmdBuf, buffer, regions) {
        //
        const memoryBarrierTemplate = { 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
            srcAccessMask: 0,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // TODO: single object support
        const regionsCp = new V.VkBufferCopy2(regions.length);
        const srcMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        const dstMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        for (let I=0;I<regions.length;I++) {
            regionsCp[I] = {srcOffset: 0, dstOffset: 0, size: ~0n, ...(regions[I].serialize ? regions[I].serialize() : regions[I])};
            srcMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_READ_BIT , $buffer: buffer[0] || buffer, offset: regionsCp[I].srcOffset, size: regionsCp[I].size },
            dstMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT, $buffer: this.handle[0], offset: regionsCp[I].dstOffset, size: regionsCp[I].size }
        }

        //
        V.vkCmdCopyBuffer2(cmdBuf[0]||cmdBuf, new V.VkCopyBufferInfo2({
            srcBuffer: buffer[0] || buffer,
            dstBuffer: this.handle[0], 
            regionCount: regionsCp.length,
            pRegions: regionsCp
        }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: srcMemoryBarrier.length, pBufferMemoryBarriers: srcMemoryBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: dstMemoryBarrier.length, pBufferMemoryBarriers: dstMemoryBarrier }));
    }
}

// TODO: copy operations support between images
class ImageObj extends AllocationObj {
    constructor(base, cInfo) {
        super(base, cInfo);
        this.isImage = true;

        if (this.cInfo) {
            //
            const deviceObj = B.Handles[this.base[0]];
            const physicalDeviceObj = B.Handles[deviceObj.base[0]];

            //
            let extent = {
                width : (cInfo.extent.width  || cInfo.extent.x || cInfo.extent[0]) || 1, 
                height: (cInfo.extent.height || cInfo.extent.y || cInfo.extent[1]) || 1, 
                depth : (cInfo.extent.depth  || cInfo.extent.z || cInfo.extent[2]) || 1};

            // TODO: support for flags
            // TODO: support for external memory allocators
            const imageType = extent.depth > 1 ? V.VK_IMAGE_TYPE_3D : (extent.height > 1 ? V.VK_IMAGE_TYPE_2D : V.VK_IMAGE_TYPE_1D);//VK_IMAGE_CREATE_2D_ARRAY_COMPATIBLE_BIT 
            const arrayLayers = cInfo.arrayLayers || 1;
            
            //
            V.vkCreateImage(this.base[0], this.pInfo = new V.VkImageCreateInfo({
                flags: 
                    V.VK_IMAGE_CREATE_2D_VIEW_COMPATIBLE_BIT_EXT | 
                    (((imageType == V.VK_IMAGE_TYPE_3D)) ? V.VK_IMAGE_CREATE_2D_ARRAY_COMPATIBLE_BIT : 0) | 
                    (((arrayLayers % 6) == 0 && extent.height == extent.width) ? V.VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT : 0),
                imageType,
                format: cInfo.format,
                extent: extent,
                mipLevels: cInfo.mipLevels || 1,
                arrayLayers: cInfo.arrayLayers || 1,
                samples: cInfo.samples || V.VK_SAMPLE_COUNT_1_BIT,
                usage: cInfo.usage | V.VK_IMAGE_USAGE_TRANSFER_SRC_BIT | V.VK_IMAGE_USAGE_TRANSFER_DST_BIT,
                sharingMode: V.VK_SHARING_MODE_EXCLUSIVE,
                tiling: cInfo.tiling || V.VK_IMAGE_TILING_OPTIMAL,
                queueFamilyIndexCount: cInfo.queueFamilyIndices?.length || 0,
                pQueueFamilyIndices: cInfo.queueFamilyIndices,
                initialLayout: cInfo.initialLayout || V.VK_IMAGE_LAYOUT_UNDEFINED
            }), null, this.handle = new BigUint64Array(1));
            deviceObj.Images[this.handle[0]] = this;

            //
            V.vkGetImageMemoryRequirements2(this.base[0], new V.VkImageMemoryRequirementsInfo2({ image: this.handle[0] }), this.memoryRequirements2 = new V.VkMemoryRequirements2());
            this.memoryRequirements = this.memoryRequirements2.memoryRequirements;
        }
    }

    getImageType() {
        const extent = this.getExtent();
        return this.pInfo?.imageType || (extent.depth > 1 ? V.VK_IMAGE_TYPE_3D : (extent.height > 1 ? V.VK_IMAGE_TYPE_2D : V.VK_IMAGE_TYPE_1D));
    }

    getLayerCount() {
        return this.pInfo?.arrayLayers || this.cInfo?.arrayLayers || 1;
    }

    getMipCount() {
        return this.pInfo?.mipLevels || this.cInfo?.mipLevels || 1;
    }

    getExtent() {
        return this.pInfo?.extent || {
            width : (this.cInfo.extent.width  || this.cInfo.extent.x ||this. cInfo.extent[0]) || 1, 
            height: (this.cInfo.extent.height || this.cInfo.extent.y || this.cInfo.extent[1]) || 1, 
            depth : (this.cInfo.extent.depth  || this.cInfo.extent.z || this.cInfo.extent[2]) || 1};
    }

    cmdCopyToImage(cmdBuf, image, regions, imageLayout = V.VK_IMAGE_LAYOUT_GENERAL) {
        //
        const memoryBarrierTemplate = { 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
            srcAccessMask: 0,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // TODO: single object support
        // TODO: autofill support
        const regionsCp = new V.VkImageCopy2(regions.length);
        const srcMemoryBarrier = new V.VkImageMemoryBarrier2(regions.length);
        const dstMemoryBarrier = new V.VkImageMemoryBarrier2(regions.length);
        for (let I=0;I<regions.length;I++) {
            regionsCp[I] = {
                bufferOffset: 0, 
                bufferRowLength: 0, 
                bufferImageHeight: 0, 
                srcImageOffset: {x:0,y:0,z:0}, 
                srcSubresource:{aspectMask:V.VK_IMAGE_ASPECT_COLOR_BIT,mipLevel:0,baseArrayLayer:0,layerCount:1}, 
                dstImageOffset: {x:0,y:0,z:0}, 
                dstSubresource:{aspectMask:V.VK_IMAGE_ASPECT_COLOR_BIT,mipLevel:0,baseArrayLayer:0,layerCount:1}, 
                extent:{width:1,height:1,depth:1}, 
                ...(regions[I].serialize ? regions[I].serialize() : regions[I])
            };
            dstMemoryBarrier[I] = {...memoryBarrierTemplate, 
                srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT, 
                image: image[0] || image, 
                subresourceRange: {aspectMask: regionsCp[I].dstSubresource.aspectMask, baseMipLevel: regionsCp[I].dstSubresource.mipLevel, levelCount: 1, baseArrayLayer: regionsCp[I].dstSubresource.baseArrayLayer, layerCount: regionsCp[I].dstSubresource.layerCount}, 
                oldLayout: imageLayout, 
                newLayout: imageLayout
            };
            srcMemoryBarrier[I] = {...memoryBarrierTemplate, 
                srcAccessMask: V.VK_ACCESS_2_TRANSFER_READ_BIT, 
                image: this.handle[0], 
                subresourceRange: {aspectMask: regionsCp[I].srcSubresource.aspectMask, baseMipLevel: regionsCp[I].srcSubresource.mipLevel, levelCount: 1, baseArrayLayer: regionsCp[I].srcSubresource.baseArrayLayer, layerCount: regionsCp[I].srcSubresource.layerCount}, 
                oldLayout: imageLayout, 
                newLayout: imageLayout
            };
        }

        // 
        V.vkCmdCopyImage2(cmdBuf[0]||cmdBuf, new V.VkCopyImageInfo2({
            srcImage: this.handle[0],
            srcImageLayout: imageLayout,
            dstImage: image[0] || image, 
            dstImageLayout: imageLayout,
            regionCount: regionsCp.length,
            pRegions: regionsCp
        }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: srcMemoryBarrier.length, pImageMemoryBarriers: srcMemoryBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: dstMemoryBarrier.length, pImageMemoryBarriers: dstMemoryBarrier }));
    }

    cmdCopyToBuffer(cmdBuf, buffer, regions, imageLayout = V.VK_IMAGE_LAYOUT_GENERAL) {
        //
        const memoryBarrierTemplate = { 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
            srcAccessMask: 0,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // TODO: single object support
        const regionsCp = new V.VkBufferImageCopy2(regions.length);
        const srcMemoryBarrier = new V.VkImageMemoryBarrier2(regions.length);
        const dstMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        for (let I=0;I<regions.length;I++) {
            regionsCp[I] = {bufferOffset: 0, bufferRowLength: 0, bufferImageHeight: 0, imageOffset: {x:0,y:0,z:0}, imageExtent:{width:1,height:1,depth:1}, imageSubresource:{aspectMask:V.VK_IMAGE_ASPECT_COLOR_BIT,mipLevel:0,baseArrayLayer:0,layerCount:1}, ...(regions[I].serialize ? regions[I].serialize() : regions[I])};
            dstMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT, $buffer: buffer[0] || buffer, offset: regionsCp[I].bufferOffset, size: ~0n, };
            srcMemoryBarrier[I] = {...memoryBarrierTemplate, 
                srcAccessMask: V.VK_ACCESS_2_TRANSFER_READ_BIT, 
                image: this.handle[0], 
                subresourceRange: {aspectMask: regionsCp[I].imageSubresource.aspectMask, baseMipLevel: regionsCp[I].imageSubresource.mipLevel, levelCount: 1, baseArrayLayer: regionsCp[I].imageSubresource.baseArrayLayer, layerCount: regionsCp[I].imageSubresource.layerCount}, 
                oldLayout: imageLayout, 
                newLayout: imageLayout
            };
        }

        // TODO: needs or no pre-barrier?
        V.vkCmdCopyImageToBuffer2(cmdBuf[0]||cmdBuf, new V.VkCopyImageToBufferInfo2({
            srcImage: buffer[0] || buffer, 
            srcImageLayout: imageLayout,
            dstBuffer: this.handle[0],
            regionCount: regionsCp.length,
            pRegions: regionsCp
        }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: srcMemoryBarrier.length, pImageMemoryBarriers: srcMemoryBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: dstMemoryBarrier.length, pBufferMemoryBarriers: dstMemoryBarrier }));
    }

    cmdCopyFromBuffer(cmdBuf, buffer, regions, imageLayout = V.VK_IMAGE_LAYOUT_GENERAL) {
        //
        const memoryBarrierTemplate = { 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT,
            srcAccessMask: 0,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // TODO: single object support
        const regionsCp = new V.VkBufferImageCopy2(regions.length);
        const srcMemoryBarrier = new V.VkBufferMemoryBarrier2(regions.length);
        const dstMemoryBarrier = new V.VkImageMemoryBarrier2(regions.length);
        for (let I=0;I<regions.length;I++) {
            regionsCp[I] = {bufferOffset: 0, bufferRowLength: 0, bufferImageHeight: 0, imageOffset: {x:0,y:0,z:0}, imageExtent:{width:1,height:1,depth:1}, imageSubresource:{aspectMask:V.VK_IMAGE_ASPECT_COLOR_BIT,mipLevel:0,baseArrayLayer:0,layerCount:1}, ...(regions[I].serialize ? regions[I].serialize() : regions[I])};
            srcMemoryBarrier[I] = {...memoryBarrierTemplate, srcAccessMask: V.VK_ACCESS_2_TRANSFER_READ_BIT , $buffer: buffer[0] || buffer, offset: regionsCp[I].bufferOffset, size: ~0n },
            dstMemoryBarrier[I] = {...memoryBarrierTemplate, 
                srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT, 
                image: this.handle[0], 
                subresourceRange: {aspectMask: regionsCp[I].imageSubresource.aspectMask, baseMipLevel: regionsCp[I].imageSubresource.mipLevel, levelCount: 1, baseArrayLayer: regionsCp[I].imageSubresource.baseArrayLayer, layerCount: regionsCp[I].imageSubresource.layerCount}, 
                oldLayout: imageLayout, 
                newLayout: imageLayout
            }
        }

        // TODO: needs or no pre-barrier?
        V.vkCmdCopyBufferToImage2(cmdBuf[0]||cmdBuf, new V.VkCopyBufferToImageInfo2({
            srcBuffer: buffer[0] || buffer,
            dstImage: this.handle[0], 
            dstImageLayout: imageLayout,
            regionCount: regionsCp.length,
            pRegions: regionsCp
        }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: srcMemoryBarrier.length, pBufferMemoryBarriers: srcMemoryBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: dstMemoryBarrier.length, pImageMemoryBarriers: dstMemoryBarrier }));
    }

    createImageView(cInfo) {
        const deviceObj = B.Handles[this.base[0]]; 
        cInfo.image = this.handle[0]; 
        cInfo.format = this.cInfo.format;
        return deviceObj.createImageView(cInfo);
    }

}

//
class ImageViewObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.DSC_ID = -1;

        if (this.cInfo) {
            //
            const deviceObj = B.Handles[this.base[0]];
            const imageObj = deviceObj.Images[this.cInfo.image];

            //
            const extent = imageObj.getExtent();;
            const layers = imageObj.getLayerCount();
            const imageT = imageObj.getImageType();

            // TODO: full support mip levels
            // TODO: support for depth and stencil aspect
            const subresourceRange = { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: this.cInfo.mipLevel || 0, levelCount: 1, baseArrayLayer: 0, layerCount: imageObj.cInfo.arrayLayers || layers, ...(this.cInfo.subresourceRange||{}) };

            // TODO: cubemap support, and check power of 6
            let imageViewType = V.VK_IMAGE_VIEW_TYPE_3D;
            if (imageT == V.VK_IMAGE_TYPE_1D) { imageViewType = (subresourceRange.layerCount > 1 ? V.VK_IMAGE_VIEW_TYPE_1D_ARRAY   : V.VK_IMAGE_VIEW_TYPE_1D  ); };
            if (imageT == V.VK_IMAGE_TYPE_2D) { imageViewType = (subresourceRange.layerCount > 1 ? V.VK_IMAGE_VIEW_TYPE_2D_ARRAY   : V.VK_IMAGE_VIEW_TYPE_2D  ); };
            if (this.cInfo.isCubemap)         { imageViewType = (subresourceRange.layerCount > 6 ? V.VK_IMAGE_VIEW_TYPE_CUBE_ARRAY : V.VK_IMAGE_VIEW_TYPE_CUBE); };

            //
            V.vkCreateImageView(this.base[0], this.imageViewInfo = new V.VkImageViewCreateInfo({
                viewType : this.cInfo.viewType || imageViewType, // TODO: automatic view type
                format : imageObj.cInfo.format,
                subresourceRange: subresourceRange,
                components: cInfo.components || { x: V.VK_COMPONENT_SWIZZLE_R, g: V.VK_COMPONENT_SWIZZLE_G, b: V.VK_COMPONENT_SWIZZLE_B, a: V.VK_COMPONENT_SWIZZLE_A }
            }).set({image: this.cInfo.image}), null, this.handle = new BigUint64Array(1));

            //
            deviceObj.ImageViews[this.handle[0]] = this;

            //
            if (this.cInfo.pipelineLayout) {
                const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];
                this.DSC_ID = descriptorsObj.resourceImages.push(this.handle[0]);
                descriptorsObj.writeDescriptors();
            }
        }
    }

    getImage() {
        return this.imageViewInfo?.image || this.cInfo?.image;
    }

    getSubresourceRange() {
        const deviceObj = B.Handles[this.base[0]];
        const imageObj = deviceObj.Images[this.cInfo.image];
        const layers = imageObj.getLayerCount();

        // TODO: full support mip levels
        // TODO: support for depth and stencil aspect
        return this.imageViewInfo?.subresourceRange || this.cInfo?.subresourceRange || 
        { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: this.cInfo.mipLevel || 0, levelCount: 1, baseArrayLayer: 0, layerCount: imageObj.cInfo.arrayLayers || layers, ...(this.cInfo.subresourceRange||{}) };
    }
}

//
class SamplerObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.DSC_ID = -1;

        //
        const deviceObj = B.Handles[this.base[0]];

        //
        V.vkCreateSampler(this.base[0], this.samplerInfo = V.IsNumber(cInfo.samplerInfo) ? new V.VkSamplerCreateInfo(cInfo.samplerInfo) : new V.VkSamplerCreateInfo({
            magFilter: V.VK_FILTER_LINEAR,
            minFilter: V.VK_FILTER_LINEAR,
            addressModeU: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
            addressModeV: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
            addressModeW: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
            ...cInfo.samplerInfo
        }), null, this.handle = new BigUint64Array(1));

        //
        deviceObj.Samplers[this.handle[0]] = this;

        //
        if (this.cInfo.pipelineLayout) {
            const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];
            this.DSC_ID = descriptorsObj.samplers.push(this.handle[0]);
            descriptorsObj.writeDescriptors();
        }
    }
}

//
B.MemoryAllocatorObj = MemoryAllocatorObj;
B.DeviceMemoryObj = DeviceMemoryObj;
B.AllocationObj = AllocationObj;
B.BufferObj = BufferObj;
B.ImageObj = ImageObj;
B.ImageViewObj = ImageViewObj;
B.SamplerObj = SamplerObj;

//
export default {
    MemoryAllocatorObj,
    DeviceMemoryObj,
    AllocationObj,
    BufferObj,
    ImageObj,
    SamplerObj,
    ImageViewObj
};
