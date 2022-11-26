import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class DescriptorsObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null);

        //
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
        this.descriptorSetLayoutCreateInfo = new V.VkDescriptorSetLayoutCreateInfo({ pNext: this.descriptorSetLayoutCreateInfoBindingFlags, bindingCount: this.descriptorSetBindings.length, pBindings: this.descriptorSetBindings });
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
    }
}

export default DeviceObj;