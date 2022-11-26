import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class PipelineObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        
    }
}

//
class ComputePipelineObj extends PipelineObj {
    constructor(base, cInfo) {
        super(base, cInfo);

        // 
        const deviceObj = B.Handles[this.base[0]];
        this.shaderStages = B.createShaderModuleInfo(B.createShaderModule(this.base[0], cInfo.shaderCode || cInfo.code), V.VK_SHADER_STAGE_COMPUTE_BIT, cInfo.pName || "main");
        this.computeCInfo = new V.VkComputePipelineCreateInfo({ stage: this.shaderStages, layout: cInfo.pipelineLayout[0] || cInfo.pipelineLayout });
        V.vkCreateComputePipelines(this.base[0], 0n, this.computeCInfo.length, this.computeCInfo, null, this.handle = new BigUint64Array(1));

        //
        deviceObj.Pipelines[this.handle[0]] = this;
    }

    dispatch(cmdBuf, x = 1, y = 1, z = 1, pushConstRaw = null, pushConstByteOffset = 0n) {
        const deviceObj = B.Handles[this.base[0]];
        const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];

        if (pushConstRaw) {
            V.vkCmdPushConstants(cmdBuf[0]||cmdBuf, this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout, V.VK_SHADER_STAGE_ALL, pushConstByteOffset, pushConstRaw.byteLength, pushConstRaw);
        }

        const memoryBarrier = new V.VkMemoryBarrier2({ 
            srcStageMask: V.VK_PIPELINE_STAGE_2_COMPUTE_SHADER_BIT,
            srcAccessMask: V.VK_ACCESS_2_SHADER_READ_BIT | V.VK_ACCESS_2_SHADER_WRITE_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        });

        V.vkCmdBindDescriptorSets(cmdBuf[0]||cmdBuf, V.VK_PIPELINE_BIND_POINT_COMPUTE, this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout, 0, descriptorsObj.descriptorSets.length, descriptorsObj.descriptorSets, 0, 0n);
        V.vkCmdBindPipeline(cmdBuf[0]||cmdBuf, V.VK_PIPELINE_BIND_POINT_COMPUTE, this.handle[0]);
        V.vkCmdDispatch(cmdBuf[0]||cmdBuf, x, y, z);
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ memoryBarrierCount: memoryBarrier.length, pMemoryBarriers: memoryBarrier }));
    }
}

//
class GraphicsPipelineObj extends PipelineObj {
    constructor(base, cInfo) {
        super(base, cInfo);

        //
        const deviceObj = B.Handles[this.base[0]];
        const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];
        const framebufferLayoutObj = B.Handles[(this.cInfo.framebufferLayout ? this.cInfo.framebufferLayout[0] : null) || this.cInfo.framebufferLayout] || B.DefaulFramebufferLayoutObj;

        // TODO: array based support
        const stageKeys = Object.keys(cInfo.shaderStages);
        this.shaderStages = new V.VkPipelineShaderStageCreateInfo(stageKeys.length);
        let N = 0; for (let stage in cInfo.shaderStages) {
            this.shaderStages[N++] = B.createShaderModuleInfo(B.createShaderModule(this.base[0], cInfo.shaderStages[stage].code), parseInt(stage), cInfo.shaderStages[stage].pName || "main");
        }

        // prefer dynamic states
        this.vertexInputInfo = new V.VkPipelineVertexInputStateCreateInfo({
            vertexBindingDescriptionCount: 0,
            pVertexBindingDescriptions: null,
            vertexAttributeDescriptionCount: 0,
            pVertexAttributeDescriptions: null
        });

        //
        this.inputAssemblyStateInfo = new V.VkPipelineInputAssemblyStateCreateInfo({
            topology: V.VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST,
            primitiveRestartEnable: false
        });

        // prefer dynamic states support
        this.viewportStateInfo = new V.VkPipelineViewportStateCreateInfo({
            viewportCount: 0,
            pViewports: null,
            scissorCount: 0,
            pScissors: null
        });

        //
        this.rasterizationInfo = new V.VkPipelineRasterizationStateCreateInfo({
            depthClampEnable: false,
            rasterizerDiscardEnable: false,
            polygonMode: V.VK_POLYGON_MODE_FILL,
            cullMode: V.VK_CULL_MODE_NONE ,
            frontFace: V.VK_FRONT_FACE_CLOCKWISE,
            depthBiasEnable: false,
            depthBiasConstantFactor: 0.0,
            depthBiasClamp: 0.0,
            depthBiasSlopeFactor: 0.0,
            lineWidth: 1.0,
        });

        //
        this.multisampleInfo = new V.VkPipelineMultisampleStateCreateInfo({
            rasterizationSamples: V.VK_SAMPLE_COUNT_1_BIT,
            minSampleShading: 1.0,
            pSampleMask: null,
            alphaToCoverageEnable: false,
            alphaToOneEnable: false,
        });

        // 
        this.colorBlendAttachment = new V.VkPipelineColorBlendAttachmentState(framebufferLayoutObj.blendAttachments);
        this.colorBlendInfo = new V.VkPipelineColorBlendStateCreateInfo({
            logicOpEnable: false,
            logicOp: V.VK_LOGIC_OP_NO_OP,
            attachmentCount: this.colorBlendAttachment.length,
            pAttachments: this.colorBlendAttachment,
            blendConstants: [0.0, 0.0, 0.0, 0.0]
        });

        // 
        this.attachmentFormats = new Uint32Array( framebufferLayoutObj.colorFormats );
        this.dynamicRenderingPipelineInfo = new V.VkPipelineRenderingCreateInfoKHR({
            colorAttachmentCount: this.attachmentFormats.length,
            pColorAttachmentFormats: this.attachmentFormats,
            depthAttachmentFormat: framebufferLayoutObj.depthFormat,
            stencilAttachmentFormat: framebufferLayoutObj.stencilFormat
        });

        //
        this.dynamicStates = new Uint32Array([V.VK_DYNAMIC_STATE_VIEWPORT_WITH_COUNT, V.VK_DYNAMIC_STATE_SCISSOR_WITH_COUNT, V.VK_DYNAMIC_STATE_VERTEX_INPUT_EXT/*, V.VK_DYNAMIC_STATE_VERTEX_INPUT_BINDING_STRIDE*/ ]);
        this.dynamicStateInfo = new V.VkPipelineDynamicStateCreateInfo({
            dynamicStateCount: this.dynamicStates.length,
            pDynamicStates: this.dynamicStates
        });

        //
        this.graphicsPipelineInfo = new V.VkGraphicsPipelineCreateInfo({
            pNext: this.dynamicRenderingPipelineInfo,
            stageCount: this.shaderStages.length,
            pStages: this.shaderStages,
            pVertexInputState: this.vertexInputInfo,
            pInputAssemblyState: this.inputAssemblyStateInfo,
            pTessellationState: null,
            pViewportState: this.viewportStateInfo,
            pRasterizationState: this.rasterizationInfo,
            pMultisampleState: this.multisampleInfo,
            pDepthStencilState: null,
            pColorBlendState: this.colorBlendInfo,
            pDynamicState: this.dynamicStateInfo,
            layout: cInfo.pipelineLayout[0] || cInfo.pipelineLayout,
            subpass: 0,
            basePipelineHandle: null,
            basePipelineIndex: -1,
        });

        //
        V.vkCreateGraphicsPipelines(this.base[0], 0n, 1, this.graphicsPipelineInfo, null, this.handle = new BigUint64Array(1));

        //
        deviceObj.Pipelines[this.handle[0]] = this;
    }

    // 
    cmdDraw({cmdBuf, vertexInfo = [], vertexCount = 3, instanceCount = 1, firstVertex = 0, firstInstance = 0, pushConstRaw = null, pushConstByteOffset = 0n, imageViews = [], viewport, scissor}) {
        //
        const memoryBarrier = new V.VkMemoryBarrier2({ 
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_GRAPHICS_BIT,
            srcAccessMask: V.VK_ACCESS_2_SHADER_READ_BIT | V.VK_ACCESS_2_SHADER_WRITE_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        });

        //
        const deviceObj = B.Handles[this.base[0]];
        const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];
        const framebufferLayoutObj = B.Handles[(this.cInfo.framebufferLayout ? this.cInfo.framebufferLayout[0] : null) || this.cInfo.framebufferLayout] || B.DefaulFramebufferLayoutObj;
        const dynamicRenderingInfo = new V.VkRenderingAttachmentInfo(Math.min(imageViews.length, framebufferLayoutObj.colorAttachmentDynamicRenderInfo.length));

        //
        let layerCount = deviceObj?.ImageViews[imageViews[0]]?.cInfo?.subresourceRange?.layerCount || 1;
        const colorTransitionBarrier = new V.VkImageMemoryBarrier2(Math.min(imageViews.length, framebufferLayoutObj.colorAttachmentDynamicRenderInfo.length));
        for (let I=0;I<colorTransitionBarrier.length;I++) {
            dynamicRenderingInfo[I] = {
                ...framebufferLayoutObj.colorAttachmentDynamicRenderInfo[I],
                imageView: imageViews[I],
                imageLayout: V.VK_IMAGE_LAYOUT_GENERAL
            };

            //
            colorTransitionBarrier[I] = {
                srcStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
                srcAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
                dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                image: deviceObj.ImageViews[imageViews[I]].cInfo.image,
                subresourceRange: deviceObj.ImageViews[imageViews[I]].cInfo.subresourceRange
            };

            //
            layerCount = Math.min(deviceObj?.ImageViews[imageViews[I]]?.cInfo?.subresourceRange?.layerCount || 1, 1);
        }

        //
        const viewport_ = new V.VkViewport(viewport);
        const scissor_ = new V.VkRect2D(scissor);

        // TODO: depth buffer support
        V.vkCmdBeginRendering(cmdBuf[0]||cmdBuf, new V.VkRenderingInfoKHR({ 
            renderArea: scissor[0], 
            layerCount, 
            viewMask: 0x0, 
            colorAttachmentCount: 
            dynamicRenderingInfo.length, 
            pColorAttachments: dynamicRenderingInfo,
            pDepthAttachment: framebufferLayoutObj.depthFormat ? { ...framebufferLayoutObj.depthAttachmentDynamicRenderInfo } : null,
            pStencilAttachment: framebufferLayoutObj.stencilFormat ? { ...framebufferLayoutObj.stencilAttachmentDynamicRenderInfo } : null,
        }));
        if (pushConstRaw) {
            V.vkCmdPushConstants(cmdBuf[0]||cmdBuf, this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout, V.VK_SHADER_STAGE_ALL, pushConstByteOffset, pushConstRaw.byteLength, pushConstRaw);
        }
        V.vkCmdBindDescriptorSets(cmdBuf[0]||cmdBuf, V.VK_PIPELINE_BIND_POINT_GRAPHICS, this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout, 0, descriptorsObj.descriptorSets.length, descriptorsObj.descriptorSets, 0, 0n);
        V.vkCmdBindPipeline(cmdBuf[0]||cmdBuf, V.VK_PIPELINE_BIND_POINT_GRAPHICS, this.handle[0]);

        //
        //V.vkCmdBindVertexBuffers2(cmdBuf[0]||cmdBuf, 0, 0, null, null, null, null); // suka
        V.vkCmdSetVertexInputEXT(cmdBuf[0]||cmdBuf, 0, null, 0, null);
        V.vkCmdSetScissorWithCount(cmdBuf[0]||cmdBuf, scissor_.length, scissor_);
        V.vkCmdSetViewportWithCount(cmdBuf[0]||cmdBuf, viewport_.length, viewport_);

        //
        if (vertexInfo && vertexInfo.length) {
            const multiDraw = new V.VkMultiDrawInfoEXT(vertexInfo);
            V.vkCmdDrawMultiEXT(cmdBuf[0]||cmdBuf, multiDraw.length, multiDraw, instanceCount, firstInstance, V.VkMultiDrawInfoEXT.byteLength);
        } else {
            V.vkCmdDraw(cmdBuf[0]||cmdBuf, vertexCount, instanceCount, firstVertex, firstInstance);
        }

        //
        V.vkCmdEndRendering(cmdBuf[0]||cmdBuf);
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: colorTransitionBarrier.length, pImageMemoryBarriers: colorTransitionBarrier }));
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ memoryBarrierCount: memoryBarrier.length, pMemoryBarriers: memoryBarrier }));
    }
}

//
B.PipelineObj = PipelineObj;
B.ComputePipelineObj = ComputePipelineObj;
B.GraphicsPipelineObj = GraphicsPipelineObj;

//
export default {
    PipelineObj, ComputePipelineObj, GraphicsPipelineObj
}