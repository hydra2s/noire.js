import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
const IsNumber = (index) => {
    return typeof index == "number" || typeof index == "bigint" || Number.isInteger(index) || typeof index == "string" && index.trim() != "" && /^\+?\d+$/.test(index.trim());
}

//
class OutstandingArray {
    constructor() {
        this.array = [];
        this.empty = [];
    }

    // TODO: support for multiple
    push(member) {
        let index = -1; if (this.empty.length > 0) { index = this.empty.shift(); this.array[index] = member; } else { index = this.array.length; this.array.push(member); }; return index;
    }

    //
    removeIndex(index) {
        const member = this.array[index];
        if (this.array[index] != null) {
            this.array[index] = null;
            this.empty.push(index);
        }
        return member;
    }

    //
    remove(member) {
        const index = this.array.indexOf(member);
        if (index >= 0) { this.removeIndex(index); };
    }
}

//
const parseIntFix = (index) => {
    return IsNumber(index) ? parseInt(index) : 0;
}

//
class OutstandingArrayHandler {
    constructor() {

    }

    get(Target, index) {
        if (IsNumber(index)) {
            return Target.array[parseIntFix(index)];
        } else 
        if (index == "map") {
            return Target.array[index].bind(Target.array);
        } else 
        if (index == "push" || index == "remove" || index == "removeIndex") {
            return Target[index].bind(Target);
        } else 
        if (index == "length") {
            return Target.array[index] || 0;
        }
    }

    set(Target, index, value) {
        if (IsNumber(index)) {
            Target.array[parseIntFix(index)] = value;
            return true;
        }
    }
}

//
class DescriptorsObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;

        //
        this.uniformBufferSize = 65536;

        //
        this.resourceDescriptorSetBindings = new V.VkDescriptorSetLayoutBinding([{
            binding: 0,
            descriptorType: V.VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE,
            descriptorCount: 256,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }, {
            binding: 1,
            descriptorType: V.VK_DESCRIPTOR_TYPE_STORAGE_IMAGE,
            descriptorCount: 256,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }]);

        //
        this.samplerDescriptorSetBindings = new V.VkDescriptorSetLayoutBinding([{
            binding: 0,
            descriptorType: V.VK_DESCRIPTOR_TYPE_SAMPLER,
            descriptorCount: 256,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }]);

        //
        this.uniformDescriptorSetBindings = new V.VkDescriptorSetLayoutBinding([{
            binding: 0,
            descriptorType: V.VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER,
            descriptorCount: 1,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }]);

        //
        this.resourceDescriptorSetBindingFlags = new Uint32Array([ 
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT,
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT
        ]);

        //
        this.samplerDescriptorSetBindingFlags = new Uint32Array([ 
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT
        ]);

        //
        this.uniformDescriptorSetBindingFlags = new Uint32Array([ 
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT
        ]);

        //
        this.descriptorLayout = new BigUint64Array(3);

        //
        this.resourceDescriptorSetLayoutCreateInfoBindingFlags = new V.VkDescriptorSetLayoutBindingFlagsCreateInfoEXT({ bindingCount: this.resourceDescriptorSetBindingFlags.length, pBindingFlags: this.resourceDescriptorSetBindingFlags });
        this.resourceDescriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.resourceDescriptorSetLayoutCreateInfoBindingFlags, flags: V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_UPDATE_AFTER_BIND_POOL_BIT | V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_DESCRIPTOR_BUFFER_BIT_EXT, bindingCount: this.resourceDescriptorSetBindings.length, pBindings: this.resourceDescriptorSetBindings });
        V.vkCreateDescriptorSetLayout(this.base[0], this.resourceDescriptorSetLayoutCreateInfo, null, this.descriptorLayout.addressOffsetOf(0));

        //
        this.samplerDescriptorSetLayoutCreateInfoBindingFlags = new V.VkDescriptorSetLayoutBindingFlagsCreateInfoEXT({ bindingCount: this.samplerDescriptorSetBindingFlags.length, pBindingFlags: this.samplerDescriptorSetBindingFlags });
        this.samplerDescriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.samplerDescriptorSetLayoutCreateInfoBindingFlags, flags: V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_UPDATE_AFTER_BIND_POOL_BIT | V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_DESCRIPTOR_BUFFER_BIT_EXT, bindingCount: this.samplerDescriptorSetBindings.length, pBindings: this.samplerDescriptorSetBindings });
        V.vkCreateDescriptorSetLayout(this.base[0], this.samplerDescriptorSetLayoutCreateInfo, null, this.descriptorLayout.addressOffsetOf(1));

        //
        this.uniformDescriptorSetLayoutCreateInfoBindingFlags = new V.VkDescriptorSetLayoutBindingFlagsCreateInfoEXT({ bindingCount: this.uniformDescriptorSetBindingFlags.length, pBindingFlags: this.uniformDescriptorSetBindingFlags });
        this.uniformDescriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.uniformDescriptorSetLayoutCreateInfoBindingFlags, flags: V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_UPDATE_AFTER_BIND_POOL_BIT | V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_DESCRIPTOR_BUFFER_BIT_EXT, bindingCount: this.uniformDescriptorSetBindings.length, pBindings: this.uniformDescriptorSetBindings });
        V.vkCreateDescriptorSetLayout(this.base[0], this.uniformDescriptorSetLayoutCreateInfo, null, this.descriptorLayout.addressOffsetOf(2));

        //
        this.pConstRange = new V.VkPushConstantRange({ stageFlags: V.VK_SHADER_STAGE_ALL, offset: 0, size: 256 });
        V.vkCreatePipelineLayout(this.base[0], new V.VkPipelineLayoutCreateInfo({
            setLayoutCount: this.descriptorLayout.length,
            pSetLayouts: this.descriptorLayout,
            pushConstantRangeCount: this.pConstRange.length,
            pPushConstantRanges: this.pConstRange
        }), null, this.handle = new BigUint64Array(1));

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];

        //
        deviceObj.Descriptors[this.handle[0]] = this;

        //
        this.samplers = new Proxy(new OutstandingArray(), new OutstandingArrayHandler());
        this.sampledImages = new Proxy(new OutstandingArray(), new OutstandingArrayHandler());
        this.storageImages = new Proxy(new OutstandingArray(), new OutstandingArrayHandler());
        this.uniformBuffer = memoryAllocatorObj.allocateMemory({ isBAR: true }, deviceObj.createBuffer({ size: this.uniformBufferSize, usage: V.VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT | V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT }));

        //
        // TODO: create dedicated image storage buffer
        V.vkGetDescriptorSetLayoutSizeEXT(this.base[0], this.descriptorLayout[0], this.resourceDescriptorSetLayoutSize = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutSizeEXT(this.base[0], this.descriptorLayout[1], this.samplerDescriptorSetLayoutSize = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutSizeEXT(this.base[0], this.descriptorLayout[2], this.uniformDescriptorSetLayoutSize = new BigUint64Array(1));

        // TODO: create dedicated image storage buffer
        // create BARZ buffers
        this.resourceDescriptorBuffer = memoryAllocatorObj.allocateMemory({ isBAR: true }, deviceObj.createBuffer({ size: this.resourceDescriptorSetLayoutSize[0], usage: V.VK_BUFFER_USAGE_RESOURCE_DESCRIPTOR_BUFFER_BIT_EXT }));
        this. samplerDescriptorBuffer = memoryAllocatorObj.allocateMemory({ isBAR: true }, deviceObj.createBuffer({ size: this.samplerDescriptorSetLayoutSize[0], usage: V.VK_BUFFER_USAGE_SAMPLER_DESCRIPTOR_BUFFER_BIT_EXT }));
        this. uniformDescriptorBuffer = memoryAllocatorObj.allocateMemory({ isBAR: true }, deviceObj.createBuffer({ size: this.uniformDescriptorSetLayoutSize[0], usage: V.VK_BUFFER_USAGE_RESOURCE_DESCRIPTOR_BUFFER_BIT_EXT }));

        //
        V.vkGetDescriptorSetLayoutBindingOffsetEXT(this.base[0], this.descriptorLayout[0], 0, this.sampledDescriptorOffset = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutBindingOffsetEXT(this.base[0], this.descriptorLayout[0], 1, this.storageDescriptorOffset = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutBindingOffsetEXT(this.base[0], this.descriptorLayout[1], 0, this.samplerDescriptorOffset = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutBindingOffsetEXT(this.base[0], this.descriptorLayout[2], 0, this.uniformDescriptorOffset = new BigUint64Array(1));

        //
        this.writeDescriptors();
    }

    cmdUpdateUniform(cmdBuf, rawData, byteOffset = 0n, queueFamilyIndex = ~0) {
        this.bufferBarrier = new V.VkBufferMemoryBarrier2({ 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT | V.VK_PIPELINE_STAGE_2_HOST_BIT,
            srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: queueFamilyIndex,
            dstQueueFamilyIndex: queueFamilyIndex,
            $buffer: this.uniformBuffer.handle[0],
            offset: byteOffset,
            size: rawData.byteLength
        });

        //
        V.vkCmdUpdateBuffer(cmdBuf[0]||cmdBuf, this.uniformBuffer.handle[0], byteOffset, rawData.byteLength, rawData);
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: this.bufferBarrier.length, pBufferMemoryBarriers: this.bufferBarrier }));
    }

    writeDescriptors() {
        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        this.sampledImageBinding = new V.VkDescriptorImageInfo(new Array(Math.min(this.sampledImages.length, 256)).fill({}).map((_, I)=>({
            imageView: this.sampledImages[I],
            imageLayout: V.VK_IMAGE_LAYOUT_GENERAL
        })));

        //
        this.storageImageBinding = new V.VkDescriptorImageInfo(new Array(Math.min(this.storageImages.length, 256)).fill({}).map((_, I)=>({
            imageView: this.storageImages[I],
            imageLayout: V.VK_IMAGE_LAYOUT_GENERAL
        })));

        //
        this.uniformBinding = new V.VkDescriptorAddressInfoEXT({
            $address: this.uniformBuffer.getDeviceAddress(),
            range: this.uniformBufferSize
        });

        //
        const P = physicalDeviceObj.deviceDescriptorBufferProperties;
        const UMAP = this. uniformDescriptorBuffer.map().address();
        const SMAP = this. samplerDescriptorBuffer.map().address();
        const RMAP = this.resourceDescriptorBuffer.map().address();

        //
        for (let I=0;I<Math.min(this.sampledImages.length, 256);I++) {
            V.vkGetDescriptorEXT(this.base[0], new V.VkDescriptorGetInfoEXT({ type: V.VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE, data: this.sampledImageBinding.addressOffsetOf(I) }), P.sampledImageDescriptorSize, RMAP + BigInt(this.sampledDescriptorOffset[0]) + BigInt(I)*BigInt(P.sampledImageDescriptorSize));
        }

        //
        for (let I=0;I<Math.min(this.storageImages.length, 256);I++) {
            V.vkGetDescriptorEXT(this.base[0], new V.VkDescriptorGetInfoEXT({ type: V.VK_DESCRIPTOR_TYPE_STORAGE_IMAGE, data: this.storageImageBinding.addressOffsetOf(I) }), P.storageImageDescriptorSize, RMAP + BigInt(this.storageDescriptorOffset[0]) + BigInt(I)*BigInt(P.storageImageDescriptorSize));
        }

        //
        for (let I=0;I<Math.min(this.samplers.length, 256);I++) {
            V.vkGetDescriptorEXT(this.base[0], new V.VkDescriptorGetInfoEXT({ type: V.VK_DESCRIPTOR_TYPE_SAMPLER, data: this.samplers.addressOffsetOf(I) }), P.samplerDescriptorSize, SMAP + BigInt(this.samplerDescriptorOffset[0]) + BigInt(I)*BigInt(P.samplerDescriptorSize));
        }

        //
        V.vkGetDescriptorEXT(this.base[0], new V.VkDescriptorGetInfoEXT({ type: V.VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER, data: this.uniformBinding }), P.uniformBufferDescriptorSize, UMAP + BigInt(this.uniformDescriptorOffset[0]));

        //
        this. uniformDescriptorBuffer.unmap();
        this. samplerDescriptorBuffer.unmap();
        this.resourceDescriptorBuffer.unmap();
    }

    cmdBindBuffers(cmdBuf, pipelineBindPoint) {
        //
        const bufferBindings = new V.VkDescriptorBufferBindingInfoEXT([
            { $address: this.resourceDescriptorBuffer.getDeviceAddress(), usage: V.VK_BUFFER_USAGE_RESOURCE_DESCRIPTOR_BUFFER_BIT_EXT },
            { $address: this.samplerDescriptorBuffer.getDeviceAddress(), usage: V.VK_BUFFER_USAGE_SAMPLER_DESCRIPTOR_BUFFER_BIT_EXT },
            { $address: this.uniformDescriptorBuffer.getDeviceAddress(), usage: V.VK_BUFFER_USAGE_RESOURCE_DESCRIPTOR_BUFFER_BIT_EXT },
        ]);

        //
        const bufferIndices = new Uint32Array([0, 1, 2]);
        const offsets = new BigUint64Array([ 0n, 0n, 0n ]);
        
        //
        V.vkCmdBindDescriptorBuffersEXT(cmdBuf[0]||cmdBuf, bufferBindings.length, bufferBindings);
        V.vkCmdSetDescriptorBufferOffsetsEXT(cmdBuf[0]||cmdBuf, pipelineBindPoint, this.handle[0], 0, bufferIndices.length, bufferIndices, offsets);
    }
}

//
B.DescriptorsObj = DescriptorsObj;
export default DescriptorsObj;
