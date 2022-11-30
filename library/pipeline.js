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
        this.computeCInfo = new V.VkComputePipelineCreateInfo({ 
            flags: V.VK_PIPELINE_CREATE_DESCRIPTOR_BUFFER_BIT_EXT,
            stage: this.shaderStages, 
            layout: cInfo.pipelineLayout[0] || cInfo.pipelineLayout 
        });
        V.vkCreateComputePipelines(this.base[0], 0n, this.computeCInfo.length, this.computeCInfo, null, this.handle = new BigUint64Array(1));

        //
        deviceObj.Pipelines[this.handle[0]] = this;
    }

    cmdDispatch(cmdBuf, x = 1, y = 1, z = 1, pushConstRaw = null, pushConstByteOffset = 0n) {
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

        descriptorsObj.cmdBindBuffers(cmdBuf[0]||cmdBuf, V.VK_PIPELINE_BIND_POINT_COMPUTE);
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
            if (stage == V.VK_PIPELINE_STAGE_MESH_SHADER_BIT_EXT || stage == V.VK_PIPELINE_STAGE_TASK_SHADER_BIT_EXT) { this.usedMeshShader = true; };
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
        this.conservativeRasterInfo = new V.VkPipelineRasterizationConservativeStateCreateInfoEXT({
            conservativeRasterizationMode: V.VK_CONSERVATIVE_RASTERIZATION_MODE_DISABLED_EXT
        });

        //
        this.rasterizationInfo = new V.VkPipelineRasterizationStateCreateInfo({
            pNext: this.conservativeRasterInfo,
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
        this.depthStencilState = new V.VkPipelineDepthStencilStateCreateInfo({
            depthTestEnable: framebufferLayoutObj.depthFormat ? true : false,
            depthWriteEnable: framebufferLayoutObj.depthFormat ? true : false,
            depthCompareOp: V.VK_COMPARE_OP_LESS_OR_EQUAL,
            depthBoundsTestEnable: true,
            stencilTestEnable: framebufferLayoutObj.stencilFormat ? true : false,
            front: {},
            back: {},
            minDepthBounds: 0.0,
            maxDepthBounds: 1.0
        });

        //
        V.vkCreateGraphicsPipelines(this.base[0], 0n, 1, this.graphicsPipelineInfo = new V.VkGraphicsPipelineCreateInfo({
            pNext: this.dynamicRenderingPipelineInfo,
            flags: V.VK_PIPELINE_CREATE_DESCRIPTOR_BUFFER_BIT_EXT,
            stageCount: this.shaderStages.length,
            pStages: this.shaderStages,
            pVertexInputState: this.vertexInputInfo,
            pInputAssemblyState: this.inputAssemblyStateInfo,
            pTessellationState: null,
            pViewportState: this.viewportStateInfo,
            pRasterizationState: this.rasterizationInfo,
            pMultisampleState: this.multisampleInfo,
            pDepthStencilState: this.depthStencilState,
            pColorBlendState: this.colorBlendInfo,
            pDynamicState: this.dynamicStateInfo,
            layout: cInfo.pipelineLayout[0] || cInfo.pipelineLayout,
            subpass: 0,
            basePipelineHandle: null,
            basePipelineIndex: -1,
        }), null, this.handle = new BigUint64Array(1));

        //
        deviceObj.Pipelines[this.handle[0]] = this;
    }

    // 
    cmdDraw({cmdBuf, vertexInfo = [], vertexCount = 3, instanceCount = 1, firstVertex = 0, firstInstance = 0, dispatch = {x: 1, y: 1, z: 1}, pushConstRaw = null, pushConstByteOffset = 0n, viewport, scissor, framebuffer}) {
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
        const framebufferObj = B.Handles[framebuffer || this.cInfo.framebuffer];

        //
        const hasDepth = framebufferLayoutObj.depthFormat;
        const hasStencil = framebufferLayoutObj.stencilFormat;

        // TODO: manually image layout
        const depthAttachmentClear = hasDepth ? new V.VkClearAttachment({ aspectMask: framebufferObj.depthStencilImageView.imageViewInfo.subresourceRange.aspectMask, ["clearValue:VkClearDepthStencilValue"]: framebufferLayoutObj.depthAttachmentDynamicRenderInfo["clearValue:VkClearDepthStencilValue"] }) : null;
        const depthDynamicRendering = hasDepth ? new V.VkRenderingAttachmentInfo({ ...framebufferLayoutObj.depthAttachmentDynamicRenderInfo, imageView: framebufferObj.depthStencilImageView.handle[0] }) : null;
        const depthTransitionBarrier = hasDepth ? new V.VkImageMemoryBarrier2({
            srcStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
            srcAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            oldLayout: depthDynamicRendering.imageLayout,
            newLayout: depthDynamicRendering.imageLayout,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
            image: framebufferObj.depthStencilImage.handle[0],
            subresourceRange: framebufferObj.depthStencilImageView.imageViewInfo.subresourceRange
        }) : null;

        // TODO: manually image layout
        const stencilAttachmentClear = hasStencil ? new V.VkClearAttachment({ aspectMask: framebufferObj.depthStencilImageView.imageViewInfo.subresourceRange.aspectMask, ["clearValue:VkClearDepthStencilValue"]: framebufferLayoutObj.stencilAttachmentDynamicRenderInfo["clearValue:VkClearDepthStencilValue"] }) : null;
        const stencilDynamicRendering = hasStencil ? new V.VkRenderingAttachmentInfo({ ...framebufferLayoutObj.stencilAttachmentDynamicRenderInfo, imageView: framebufferObj.depthStencilImageView.handle[0] }) : null;
        const stencilTransitionBarrier = hasStencil ? new V.VkImageMemoryBarrier2({
            srcStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
            srcAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
            oldLayout: stencilDynamicRendering.imageLayout,
            newLayout: stencilDynamicRendering.imageLayout,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
            image: framebufferObj.depthStencilImage.handle[0],
            subresourceRange: framebufferObj.depthStencilImageView.imageViewInfo.subresourceRange
        }) : null;

        //
        const viewport_ = new V.VkViewport(viewport);
        const scissor_ = new V.VkRect2D(scissor);

        //
        const colorDynamicRendering = new V.VkRenderingAttachmentInfo(Math.min(framebufferObj.colorImageViews.length, framebufferLayoutObj.colorAttachmentDynamicRenderInfo.length));
        const colorTransitionBarrier = new V.VkImageMemoryBarrier2(Math.min(framebufferObj.colorImageViews.length, framebufferLayoutObj.colorAttachmentDynamicRenderInfo.length));
        const colorAttachmentClear = new V.VkClearAttachment(colorTransitionBarrier.length);

        //
        let layerCount = framebufferObj.colorImageViews[0].imageViewInfo.subresourceRange.layerCount || 1;
        for (let I=0;I<colorTransitionBarrier.length;I++) {
            colorAttachmentClear[I] = { aspectMask: framebufferObj.colorImageViews[I].imageViewInfo.subresourceRange.aspectMask, colorAttachment: I, ["clearValue:f32[4]"]: framebufferLayoutObj.colorAttachmentDynamicRenderInfo[I]["clearValue:f32[4]"] };
            colorDynamicRendering[I] = {
                ...framebufferLayoutObj.colorAttachmentDynamicRenderInfo[I],
                imageView: framebufferObj.colorImageViews[I].handle[0]
            };

            //
            colorTransitionBarrier[I] = {
                srcStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
                srcAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
                dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT,
                oldLayout: colorDynamicRendering[I].imageLayout,
                newLayout: colorDynamicRendering[I].imageLayout,
                srcQueueFamilyIndex: ~0,
                dstQueueFamilyIndex: ~0,
                image: framebufferObj.colorImages[I].handle[0],
                subresourceRange: framebufferObj.colorImageViews[I].imageViewInfo.subresourceRange
            };

            //
            layerCount = Math.min(framebufferObj.colorImageViews[I].imageViewInfo.layerCount || 1, 1);
        }

        // 
        V.vkCmdBeginRendering(cmdBuf[0]||cmdBuf, new V.VkRenderingInfoKHR({ 
            renderArea: scissor_[0], 
            layerCount, 
            viewMask: 0x0, 
            colorAttachmentCount: colorDynamicRendering.length, 
            pColorAttachments: colorDynamicRendering,
            pDepthAttachment: null,//depthDynamicRendering,
            pStencilAttachment: null,//stencilDynamicRendering,
        }));
        if (pushConstRaw) {
            //V.vkCmdPushConstants(cmdBuf[0]||cmdBuf, this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout, V.VK_SHADER_STAGE_ALL, pushConstByteOffset, pushConstRaw.byteLength, pushConstRaw);
        }

        //
        //descriptorsObj.cmdBindBuffers(cmdBuf[0]||cmdBuf, V.VK_PIPELINE_BIND_POINT_GRAPHICS);
        //V.vkCmdBindPipeline(cmdBuf[0]||cmdBuf, V.VK_PIPELINE_BIND_POINT_GRAPHICS, this.handle[0]);
        //V.vkCmdSetVertexInputEXT(cmdBuf[0]||cmdBuf, 0, null, 0, null);
        //V.vkCmdSetScissorWithCount(cmdBuf[0]||cmdBuf, scissor_.length, scissor_);
        //V.vkCmdSetViewportWithCount(cmdBuf[0]||cmdBuf, viewport_.length, viewport_);

        // 
        let rendered = false;
        if (this.usedMeshShader && dispatch) {
            //V.vkCmdDrawMeshTasksEXT(cmdBuf[0]||cmdBuf, dispatch.x || 1, dispatch.y || 1, dispatch.z || 1); rendered = true;
        } else
        if (!this.usedMeshShader && vertexInfo && vertexInfo.length) {
            const multiDraw = new V.VkMultiDrawInfoEXT(vertexInfo);
            //V.vkCmdDrawMultiEXT(cmdBuf[0]||cmdBuf, multiDraw.length, multiDraw, instanceCount, firstInstance, V.VkMultiDrawInfoEXT.byteLength); rendered = true;
        } else 
        if (!this.usedMeshShader && vertexCount > 0) {
            //V.vkCmdDraw(cmdBuf[0]||cmdBuf, vertexCount, instanceCount, firstVertex, firstInstance); rendered = true;
        } else {
            const rects_ = new V.VkClearRect({ rect: scissor_[0], baseArrayLayer: 0, layerCount }); 
            V.vkCmdClearAttachments(cmdBuf[0]||cmdBuf, colorAttachmentClear.length, colorAttachmentClear, rects_.length, rects_);
            if (  depthAttachmentClear) V.vkCmdClearAttachments(cmdBuf[0]||cmdBuf,   depthAttachmentClear.length,   depthAttachmentClear, scissor_.length, scissor_);
            if (stencilAttachmentClear) V.vkCmdClearAttachments(cmdBuf[0]||cmdBuf, stencilAttachmentClear.length, stencilAttachmentClear, scissor_.length, scissor_);
        }

        //
        V.vkCmdEndRendering(cmdBuf[0]||cmdBuf);

        if (rendered) {
            //V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ memoryBarrierCount: memoryBarrier.length, pMemoryBarriers: memoryBarrier }));
        };

        //V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: colorTransitionBarrier.length, pImageMemoryBarriers: colorTransitionBarrier }));
        //if (  hasDepth) V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount:   depthTransitionBarrier.length, pImageMemoryBarriers:   depthTransitionBarrier }));
        //if (hasStencil) V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: stencilTransitionBarrier.length, pImageMemoryBarriers: stencilTransitionBarrier }));
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