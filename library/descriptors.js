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
const bigIntMax = (...args) => args.reduce((m, e) => e > m ? e : m);
const bigIntMin = (...args) => args.reduce((m, e) => e < m ? e : m);

//
class DescriptorsObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;

        //
        this.uniformBufferSize = 65536;

        //
        this.resourceDescriptorSetBindings = new V.VkDescriptorSetLayoutBinding([{
            binding: 0,
            descriptorType: V.VK_DESCRIPTOR_TYPE_MUTABLE_EXT,
            descriptorCount: 1024,
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
            descriptorType: V.VK_DESCRIPTOR_TYPE_INLINE_UNIFORM_BLOCK,
            descriptorCount: this.uniformBufferSize,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }]);

        //
        this.resourceDescriptorSetBindingFlags = new Uint32Array([ 
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT ,
            //V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT 
        ]);

        //
        this.samplerDescriptorSetBindingFlags = new Uint32Array([ 
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT 
        ]);

        //
        this.uniformDescriptorSetBindingFlags = new Uint32Array([ 
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT 
        ]);

        //
        this.descriptorLayout = new BigUint64Array(3);

        //
        this.mutableDescriptorTypes = new Uint32Array([V.VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE, V.VK_DESCRIPTOR_TYPE_STORAGE_IMAGE]);
        this.mutableDescriptorLists = new V.VkMutableDescriptorTypeListEXT([{
            descriptorTypeCount: this.mutableDescriptorTypes.length,
            pDescriptorTypes: this.mutableDescriptorTypes
        }]);

        //
        this.mutableDescriptorInfo = new V.VkMutableDescriptorTypeCreateInfoEXT({
            mutableDescriptorTypeListCount: this.mutableDescriptorLists.length,
            pMutableDescriptorTypeLists: this.mutableDescriptorLists
        });

        //
        this.resourceDescriptorSetLayoutCreateInfoBindingFlags = new V.VkDescriptorSetLayoutBindingFlagsCreateInfoEXT({ pNext: this.mutableDescriptorInfo, bindingCount: this.resourceDescriptorSetBindingFlags.length, pBindingFlags: this.resourceDescriptorSetBindingFlags });
        this.resourceDescriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.resourceDescriptorSetLayoutCreateInfoBindingFlags, flags: V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_DESCRIPTOR_BUFFER_BIT_EXT, bindingCount: this.resourceDescriptorSetBindings.length, pBindings: this.resourceDescriptorSetBindings });
        V.vkCreateDescriptorSetLayout(this.base[0], this.resourceDescriptorSetLayoutCreateInfo, null, this.descriptorLayout.addressOffsetOf(0));

        //
        this.samplerDescriptorSetLayoutCreateInfoBindingFlags = new V.VkDescriptorSetLayoutBindingFlagsCreateInfoEXT({ bindingCount: this.samplerDescriptorSetBindingFlags.length, pBindingFlags: this.samplerDescriptorSetBindingFlags });
        this.samplerDescriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.samplerDescriptorSetLayoutCreateInfoBindingFlags, flags: V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_DESCRIPTOR_BUFFER_BIT_EXT, bindingCount: this.samplerDescriptorSetBindings.length, pBindings: this.samplerDescriptorSetBindings });
        V.vkCreateDescriptorSetLayout(this.base[0], this.samplerDescriptorSetLayoutCreateInfo, null, this.descriptorLayout.addressOffsetOf(1));

        //
        this.uniformDescriptorSetLayoutCreateInfoBindingFlags = new V.VkDescriptorSetLayoutBindingFlagsCreateInfoEXT({ bindingCount: this.uniformDescriptorSetBindingFlags.length, pBindingFlags: this.uniformDescriptorSetBindingFlags });
        this.uniformDescriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.uniformDescriptorSetLayoutCreateInfoBindingFlags, flags: V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_DESCRIPTOR_BUFFER_BIT_EXT, bindingCount: this.uniformDescriptorSetBindings.length, pBindings: this.uniformDescriptorSetBindings });
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
        this.resourceImages = new Proxy(new OutstandingArray(), new OutstandingArrayHandler());

        //
        // TODO: create dedicated image resource buffer
        V.vkGetDescriptorSetLayoutSizeEXT(this.base[0], this.descriptorLayout[0], this.resourceDescriptorSetLayoutSize = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutSizeEXT(this.base[0], this.descriptorLayout[1], this.samplerDescriptorSetLayoutSize = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutSizeEXT(this.base[0], this.descriptorLayout[2], this.uniformDescriptorSetLayoutSize = new BigUint64Array(1));

        // TODO: create dedicated image resource buffer
        // create BARZ buffers
        this.resourceDescriptorBuffer = memoryAllocatorObj.allocateMemory({ isBAR: true }, deviceObj.createBuffer({ size: this.resourceDescriptorSetLayoutSize[0], usage: V.VK_BUFFER_USAGE_RESOURCE_DESCRIPTOR_BUFFER_BIT_EXT }));
        this. samplerDescriptorBuffer = memoryAllocatorObj.allocateMemory({ isBAR: true }, deviceObj.createBuffer({ size: this.samplerDescriptorSetLayoutSize[0], usage: V.VK_BUFFER_USAGE_SAMPLER_DESCRIPTOR_BUFFER_BIT_EXT }));

        this. uniformDescriptorBuffer = memoryAllocatorObj.allocateMemory({  isDevice: true }, deviceObj.createBuffer({ size: this.uniformBufferSize, usage: V.VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT | V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | V.VK_BUFFER_USAGE_RESOURCE_DESCRIPTOR_BUFFER_BIT_EXT }));
        this. uniformDescriptorBufferCPU = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: this.uniformBufferSize, usage: V.VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT | V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | V.VK_BUFFER_USAGE_RESOURCE_DESCRIPTOR_BUFFER_BIT_EXT }));

        // 
        V.vkGetDescriptorSetLayoutBindingOffsetEXT(this.base[0], this.descriptorLayout[0], 0, this.resourceDescriptorOffset = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutBindingOffsetEXT(this.base[0], this.descriptorLayout[1], 0, this.samplerDescriptorOffset = new BigUint64Array(1));
        V.vkGetDescriptorSetLayoutBindingOffsetEXT(this.base[0], this.descriptorLayout[2], 0, this.uniformDescriptorOffset = new BigUint64Array(1));

        //
        this.writeDescriptors();
    }

    updateUniformDirect(rawData, byteOffset = 0n) {
        this.uniformDescriptorBufferCPU.map().set(rawData, byteOffset);
        this.uniformDescriptorBufferCPU.unmap();
    }

    cmdBarrier(cmdBuf, queueFamilyIndex = ~0) {
        this.bufferBarrier = new V.VkBufferMemoryBarrier2({ 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT | V.VK_PIPELINE_STAGE_2_HOST_BIT,
            srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: queueFamilyIndex,
            dstQueueFamilyIndex: queueFamilyIndex,
            $buffer: this.uniformDescriptorBuffer.handle[0],
            offset: 0,
            size: this.uniformBufferSize
        });

        //
        this.uniformDescriptorBufferCPU.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, this.uniformDescriptorBuffer.handle[0], [{srcOffset: 0, dstOffset: 0, size: this.uniformBufferSize}]);
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: this.bufferBarrier.length, pBufferMemoryBarriers: this.bufferBarrier }));
    }

    writeDescriptors() {
        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        this.resourceImageBinding = new V.VkDescriptorImageInfo(new Array(Math.min(this.resourceImages.length, 1024)).fill({}).map((_, I)=>({
            imageView: this.resourceImages[I]
        })));

        //
        const P = physicalDeviceObj.deviceDescriptorBufferProperties;
        const SMAP = this. samplerDescriptorBuffer.map().address();
        const RMAP = this.resourceDescriptorBuffer.map().address();

        //
        for (let I=0;I<Math.min(this.resourceImages.length, 1024);I++) {
            V.vkGetDescriptorEXT(this.base[0], new V.VkDescriptorGetInfoEXT({ type: deviceObj.ImageViews[this.resourceImages[I]].cInfo.type == "storage" ? V.VK_DESCRIPTOR_TYPE_STORAGE_IMAGE : V.VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE, data: this.resourceImageBinding.addressOffsetOf(I) }), P.storageImageDescriptorSize, RMAP + BigInt(this.resourceDescriptorOffset[0]) + BigInt(I)*BigInt(bigIntMax(P.storageImageDescriptorSize, P.sampledImageDescriptorSize)));
        }

        //
        for (let I=0;I<Math.min(this.samplers.length, 256);I++) {
            V.vkGetDescriptorEXT(this.base[0], new V.VkDescriptorGetInfoEXT({ type: V.VK_DESCRIPTOR_TYPE_SAMPLER, data: new BigUint64Array([this.samplers[I]]) }), P.samplerDescriptorSize, SMAP + BigInt(this.samplerDescriptorOffset[0]) + BigInt(I)*BigInt(P.samplerDescriptorSize));
        }

        //
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
