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
        this.shaderStages = L.createShaderModuleInfo(L.createShaderModule(this.base[0], cInfo.shaderCode), V.VK_SHADER_STAGE_COMPUTE_BIT, cInfo.pName || "main");
        this.computeCInfo = new V.VkComputePipelineCreateInfo({ stage: this.shaderStages, layout: cInfo.pipelineLayout });
        V.vkCreateComputePipelines(this.base[0], 0n, this.computeCInfo.length, this.computeCInfo, null, this.handle = new BigUint64Array(1));

        //
        deviceObj.Pipelines[this.handle[0]] = this;
    }
}

//
class GraphicsPipelineObj extends PipelineObj {
    constructor(base, cInfo) {
        super(base, cInfo);
        
        // TODO: graphics pipeline support
        /*
        // TODO: better construction!!
        const shaderStages = new V.VkPipelineShaderStageCreateInfo(2);
        //shaderStages[0] = L.createShaderModuleInfo(L.createShaderModule(device[0], await fs.promises.readFile("shaders/triangle.vert.spv")), V.VK_SHADER_STAGE_VERTEX_BIT);
        //shaderStages[1] = L.createShaderModuleInfo(L.createShaderModule(device[0], await fs.promises.readFile("shaders/triangle.frag.spv")), V.VK_SHADER_STAGE_FRAGMENT_BIT);

        //
        const vertexInputInfo = new V.VkPipelineVertexInputStateCreateInfo({
            vertexBindingDescriptionCount: 1,
            pVertexBindingDescriptions: posVertexBindingDescr,
            vertexAttributeDescriptionCount: 1,
            pVertexAttributeDescriptions: posVertexAttrDescr
        });

        //
        const inputAssemblyStateInfo = new V.VkPipelineInputAssemblyStateCreateInfo({
            topology: V.VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST,
            primitiveRestartEnable: false
        });

        //
        const viewport = new V.VkViewport({
            //x: 0, y: 0, width: windowSize[0], height: windowSize[1], minDepth: 0.0, maxDepth: 1.0
        });
        viewport[":f32[6]"] = [0, 0, windowSize[0], windowSize[1], 0.0, 1.0];

        //
        const scissor = new V.VkRect2D({
            ["offset:u32[2]"]: [0,0],
            ["extent:u32[2]"]: windowSize
        });

        //
        const viewportStateInfo = new V.VkPipelineViewportStateCreateInfo({
            viewportCount: 1,
            pViewports: viewport,
            scissorCount: 1,
            pScissors: scissor
        });

        //
        const rasterizationInfo = new V.VkPipelineRasterizationStateCreateInfo({
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
        const multisampleInfo = new V.VkPipelineMultisampleStateCreateInfo({
            rasterizationSamples: V.VK_SAMPLE_COUNT_1_BIT,
            minSampleShading: 1.0,
            pSampleMask: null,
            alphaToCoverageEnable: false,
            alphaToOneEnable: false,
        });

        //
        const colorBlendAttachment = new V.VkPipelineColorBlendAttachmentState({
            blendEnable: true,
            srcColorBlendFactor: V.VK_BLEND_FACTOR_SRC_ALPHA,
            dstColorBlendFactor: V.VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA,
            colorBlendOp: V.VK_BLEND_OP_ADD,
            srcAlphaBlendFactor: V.VK_BLEND_FACTOR_ONE,
            dstAlphaBlendFactor: V.VK_BLEND_FACTOR_ZERO,
            alphaBlendOp: V.VK_BLEND_OP_ADD,
            colorWriteMask: (
                V.VK_COLOR_COMPONENT_R_BIT |
                V.VK_COLOR_COMPONENT_G_BIT |
                V.VK_COLOR_COMPONENT_B_BIT |
                V.VK_COLOR_COMPONENT_A_BIT
            )
        });

        //
        const colorBlendInfo = new V.VkPipelineColorBlendStateCreateInfo({
            logicOpEnable: false,
            logicOp: V.VK_LOGIC_OP_NO_OP,
            attachmentCount: 1,
            pAttachments: colorBlendAttachment,
            blendConstants: [0.0, 0.0, 0.0, 0.0]
        });

        //
        const attachmentFormats = new Uint32Array([V.VK_FORMAT_B8G8R8A8_UNORM]);
        const dynamicRenderingPipelineInfo = new V.VkPipelineRenderingCreateInfoKHR({
            colorAttachmentCount: attachmentFormats.length,
            pColorAttachmentFormats: attachmentFormats
        });

        //
        const graphicsPipelineInfo = new V.VkGraphicsPipelineCreateInfo({
            pNext: dynamicRenderingPipelineInfo,
            stageCount: shaderStages.length,
            pStages: shaderStages,
            pVertexInputState: vertexInputInfo,
            pInputAssemblyState: inputAssemblyStateInfo,
            pTessellationState: null,
            pViewportState: viewportStateInfo,
            pRasterizationState: rasterizationInfo,
            pMultisampleState: multisampleInfo,
            pDepthStencilState: null,
            pColorBlendState: colorBlendInfo,
            pDynamicState: null,
            layout: pipelineLayout[0],
            subpass: 0,
            basePipelineHandle: null,
            basePipelineIndex: -1,
        });

        //
        const pipeline = new BigUint64Array(1);
        V.vkCreateGraphicsPipelines(device[0], 0n, 1, graphicsPipelineInfo, null, pipeline);
        */

        //
        deviceObj.Pipelines[this.handle[0]] = this;
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