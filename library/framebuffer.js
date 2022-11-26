import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class FramebufferLayoutObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.handle = new BigUint64Array([0n]);
        this.handle[0] = this.handle.address();
        B.Handles[this.handle[0]] = this;

        //
        this.blendAttachments = new Array(cInfo.colorAttachments.length).fill({}).map((_, I)=>{
            return {
                blendEnable: false,
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
                ),
                ...cInfo.colorAttachments[I].blendState
            }
        });

        //
        this.colorFormats = new Array(cInfo.colorAttachments.length).fill({}).map((_, I)=>{
            return cInfo.colorAttachments[I].format
        });

        //
        this.depthFormat = cInfo.depthAttachment.format || 0;
        this.stencilFormat = cInfo.stencilAttachment.format || 0;

        //
        this.colorAttachmentDynamicRenderInfo = new Array(cInfo.colorAttachments.length).fill({}).map((_, I)=>{
            return {
                loadOp: V.VK_ATTACHMENT_LOAD_OP_CLEAR,
                storeOp: V.VK_ATTACHMENT_STORE_OP_STORE,
                imageLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                "clearValue:f32[4]": [0.0, 0.0, 0.0, 0.0],
                ...cInfo.colorAttachments[I].dynamicState
            };
        });

        //
        this.depthAttachmentDynamicRenderInfo = {
            loadOp: V.VK_ATTACHMENT_LOAD_OP_CLEAR,
            storeOp: V.VK_ATTACHMENT_STORE_OP_STORE,
            imageLayout: V.VK_IMAGE_LAYOUT_GENERAL,
            "clearValue:VkClearDepthStencilValue": {depth: 1.0, stencil: 0},
            ...cInfo.depthAttachment.dynamicState
        };

        //
        this.stencilAttachmentDynamicRenderInfo = {
            loadOp: V.VK_ATTACHMENT_LOAD_OP_CLEAR,
            storeOp: V.VK_ATTACHMENT_STORE_OP_STORE,
            imageLayout: V.VK_IMAGE_LAYOUT_GENERAL,
            "clearValue:VkClearDepthStencilValue": {depth: 1.0, stencil: 0},
            ...cInfo.stencilAttachment.dynamicState
        };
    }
}

//
B.FramebufferLayoutObj = FramebufferLayoutObj;

//
const DefaulFramebufferLayoutObj = new FramebufferLayoutObj(null, {
    colorAttachments: [{
        blend: {},
        format: V.VK_FORMAT_B8G8R8A8_UNORM,
        dynamicState: {}
    }],
    depthAttachment: {
        format: V.VK_FORMAT_UNDEFINED,
        dynamicState: {}
    },
    stencilAttachment: {
        format: V.VK_FORMAT_UNDEFINED,
        dynamicState: {}
    }
});

//
B.DefaulFramebufferLayoutObj = DefaulFramebufferLayoutObj;

//
export default { FramebufferLayoutObj, DefaulFramebufferLayoutObj };
