import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class MemoryAllocatorObj extends BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.Memories = {};
        this.handle = new BigUint64Array([0]);
        this.handle[0] = this.handle.address();
        B.Handles[this.handle[0]] = this;
    }

    allocateMemory(cInfo, allocationObj = null) {
        //
        if (allocationObj) {
            cInfo.memoryRequirements2 = allocationObj.memoryRequirements2;
            cInfo.memoryRequirements = allocationObj.memoryRequirements;
        }

        //
        const deviceMemory = new DeviceMemoryObj(this.handle[0], cInfo);
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
            V.vkBindBufferMemory(deviceObj.handle[0], allocation.handle[0], deviceMemory.handle[0], memoryOffset);
        } else
        if (allocationObj?.isImage) {
            V.vkBindImageMemory(deviceObj.handle[0], allocation.handle[0], deviceMemory.handle[0], memoryOffset);
        }

        //
        this.Memories[deviceMemory.handle[0]] = deviceMemory;
        deviceObj.Memories[deviceMemory.handle[0]] = deviceMemory;
        deviceMemory.Allocations[memoryOffset] = allocationObj;
    }
}

//
class DeviceMemoryObj extends BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.Allocations = {};

        //
        const memoryAllocatorObj = B.Handles[this.base[0]];
        const deviceObj = B.Handles[memoryAllocatorObj.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        const propertyFlag = cInfo.isHost ? (
            V.VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT |
            V.VK_MEMORY_PROPERTY_HOST_COHERENT_BIT
        ) : V.VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT;

        //
        V.vkAllocateMemory(deviceObj.handle[0], new V.VkMemoryAllocateInfo({
            pNext: new V.VkMemoryAllocateFlagsInfo({
                flags: V.VK_MEMORY_ALLOCATE_DEVICE_ADDRESS_BIT_KHR
            }),
            allocationSize: cInfo.memoryRequirements.size,
            memoryTypeIndex: B.getMemoryTypeIndex(physicalDeviceObj.handle[0], cInfo.memoryRequirements.memoryTypeBits, propertyFlag)
        }), null, this.handle = new BigUint64Array(1));
    }
}

//
class AllocationObj extends BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.memoryOffset = 0n;
        this.deviceMemory = null;
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
            usage: cInfo.usage | V.VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT | V.VK_BUFFER_USAGE_TRANSFER_SRC_BIT | V.VK_BUFFER_USAGE_TRANSFER_DST_BIT,
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
        return B.getBufferDeviceAddress(this.base[0], this.handle[0]);
    }
}

//
class ImageObj extends AllocationObj {
    constructor(base, cInfo) {
        super(base, cInfo);
        this.isImage = true;

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];


        // TODO: conversion array based extent to object


        // TODO: support for external memory allocators
        V.vkCreateImage(this.base[0], this.pInfo = new V.VkImageCreateInfo({
            imageType: cInfo.extent.depth > 1 ? VK_IMAGE_TYPE_3D : (cInfo.extent.height > 1 ? VK_IMAGE_TYPE_2D : VK_IMAGE_TYPE_1D),
            format: cInfo.format,
            extent: {width: cInfo.extent.width || 1, height: cInfo.extent.height || 1, depth: cInfo.extent.depth || 1},
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

//
B.MemoryAllocatorObj = MemoryAllocatorObj;
B.DeviceMemoryObj = DeviceMemoryObj;
B.AllocationObj = AllocationObj;
B.BufferObj = BufferObj;
B.ImageObj = ImageObj;

//
export default {
    MemoryAllocatorObj,
    DeviceMemoryObj,
    AllocationObj,
    BufferObj,
    ImageObj
};
