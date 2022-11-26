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
        if (this.empty.length > 0) { this.array[this.empty.shift()] = member; } else { this.array.push(member); };
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
        super(base, null);

        //
        this.uniformBufferSize = 65536;
        this.imagePoolSize = new V.VkDescriptorPoolSize([{
            type: V.VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE,
            descriptorCount: 256
        }, {
            type: V.VK_DESCRIPTOR_TYPE_STORAGE_IMAGE,
            descriptorCount: 256
        }, {
            type: V.VK_DESCRIPTOR_TYPE_SAMPLER,
            descriptorCount: 256
        }, {
            type: V.VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER,
            descriptorCount: 1
        }]);

        //
        V.vkCreateDescriptorPool(this.base[0], this.poolInfo = new V.VkDescriptorPoolCreateInfo({
            flags: V.VK_DESCRIPTOR_POOL_CREATE_UPDATE_AFTER_BIND_BIT,
            poolSizeCount: this.imagePoolSize.length,
            pPoolSizes: this.imagePoolSize,
            maxSets: 4
        }), null, this.descriptorPool = new BigUint64Array(1));

        //
        this.descriptorSetBindings = new V.VkDescriptorSetLayoutBinding([{
            binding: 0,
            descriptorType: V.VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE,
            descriptorCount: 256,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }, {
            binding: 1,
            descriptorType: V.VK_DESCRIPTOR_TYPE_SAMPLER,
            descriptorCount: 256,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }, {
            binding: 2,
            descriptorType: V.VK_DESCRIPTOR_TYPE_STORAGE_IMAGE,
            descriptorCount: 256,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }, {
            binding: 3,
            descriptorType: V.VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER,
            descriptorCount: 1,
            stageFlags: V.VK_SHADER_STAGE_ALL,
        }]);

        //
        this.descriptorSetBindingFlags = new Uint32Array([ 
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT,
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT,
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT,
            V.VK_DESCRIPTOR_BINDING_PARTIALLY_BOUND_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_UNUSED_WHILE_PENDING_BIT | V.VK_DESCRIPTOR_BINDING_UPDATE_AFTER_BIND_BIT
        ]);

        //
        this.descriptorSetLayoutCreateInfoBindingFlags = new V.VkDescriptorSetLayoutBindingFlagsCreateInfoEXT({ bindingCount: this.descriptorSetBindingFlags.length, pBindingFlags: this.descriptorSetBindingFlags });
        this.descriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.descriptorSetLayoutCreateInfoBindingFlags, flags: V.VK_DESCRIPTOR_SET_LAYOUT_CREATE_UPDATE_AFTER_BIND_POOL_BIT, bindingCount: this.descriptorSetBindings.length, pBindings: this.descriptorSetBindings });
        V.vkCreateDescriptorSetLayout(this.base[0], this.descriptorSetLayoutCreateInfo, null, this.descriptorLayout = new BigUint64Array(1));

        //
        this.pConstRange = new V.VkPushConstantRange({ stageFlags: V.VK_SHADER_STAGE_ALL, offset: 0, size: 256 });
        V.vkCreatePipelineLayout(this.base[0], new V.VkPipelineLayoutCreateInfo({
            setLayoutCount: this.descriptorLayout.length,
            pSetLayouts: this.descriptorLayout,
            pushConstantRangeCount: this.pConstRange.length,
            pPushConstantRanges: this.pConstRange
        }), null, this.handle = new BigUint64Array(1));

        // 
        this.allocInfo = new V.VkDescriptorSetAllocateInfo({
            descriptorPool: this.descriptorPool[0],
            descriptorSetCount: this.descriptorLayout.length, 
            pSetLayouts: this.descriptorLayout
        });
        V.vkAllocateDescriptorSets(this.base[0], this.allocInfo, this.descriptorSets = new BigUint64Array(this.descriptorLayout.length));

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        deviceObj.Descriptors[this.handle[0]] = this;

        //
        this.sampledImages = new Proxy(new OutstandingArray(), new OutstandingArrayHandler());
        this.storageImages = new Proxy(new OutstandingArray(), new OutstandingArrayHandler());
        this.samplers = new Proxy(new OutstandingArray(), new OutstandingArrayHandler());

        // create BARZ buffer
        this.uniformBuffer = B.createTypedBuffer(physicalDeviceObj.handle[0], this.base[0], V.VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, this.uniformBufferSize, "BAR");

        //
        this.writeDescriptors();
    }

    cmdUpdateUniform(cmdBuf, rawData, byteOffset = 0n, queueFamilyIndex = ~0) {
        this.bufferBarrier = new V.VkBufferMemoryBarrier2({ 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_TRANSFER_BIT | V.VK_PIPELINE_STAGE_2_HOST_BIT,
            srcAccessMask: V.VK_ACCESS_2_TRANSFER_WRITE_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex,
            dstQueueFamilyIndex,
            buffer: this.uniformBuffer,
            offset: byteOffset,
            size: rawData.byteLength
        });
        V.vkCmdUpdateBuffer(cmdBuf[0]||cmdBuf, this.uniformBuffer, byteOffset, rawData.byteLength, rawData);
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: this.bufferBarrier.length, pBufferMemoryBarriers: this.bufferBarrier }));
    }

    writeDescriptors() {
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
        this.samplerBinding = new V.VkDescriptorImageInfo(new Array(Math.min(this.samplers.length, 256)).fill({}).map((_, I)=>({
            sampler: this.samplers[I]
        })));

        //
        this.uniformBinding = new V.VkDescriptorBufferInfo({
            $buffer: this.uniformBuffer,
            offset: 0,
            range: this.uniformBufferSize
        });

        //
        let writes = [{
            dstBinding: 3,
            dstSet: this.descriptorSets[0],
            descriptorCount: Math.min(this.uniformBinding.length, 1),
            descriptorType: V.VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER,
            pBufferInfo: this.uniformBinding
        }];

        if (this.storageImages.length > 0) {
            writes.push({
                dstBinding: 2,
                dstSet: this.descriptorSets[0],
                descriptorCount: this.storageImageBinding.length,
                descriptorType: V.VK_DESCRIPTOR_TYPE_STORAGE_IMAGE,
                pImageInfo: this.storageImageBinding
            });
        }

        if (this.samplers.length > 0) { 
            writes.push({
                dstBinding: 1,
                dstSet: this.descriptorSets[0],
                descriptorCount: this.samplerBinding.length,
                descriptorType: V.VK_DESCRIPTOR_TYPE_SAMPLER,
                pImageInfo: this.samplerBinding
            });
        }

        if (this.sampledImages.length > 0) {
            writes.push({
                dstBinding: 0,
                dstSet: this.descriptorSets[0],
                descriptorCount: this.sampledImageBinding.length,
                descriptorType: V.VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE,
                pImageInfo: this.sampledImageBinding
            });
        }

        //
        this.writeDescriptorInfo = new V.VkWriteDescriptorSet(writes);

        //
        V.vkUpdateDescriptorSets(this.base[0], this.writeDescriptorInfo.length, this.writeDescriptorInfo, 0, null);
    }
}

//
B.DescriptorsObj = DescriptorsObj;
export default DescriptorsObj;
