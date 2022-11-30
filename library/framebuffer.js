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
        this.depthFormat = cInfo.depthAttachment?.format || 0;
        this.stencilFormat = cInfo.stencilAttachment?.format || 0;

        //
        this.colorAttachmentDynamicRenderInfo = new Array(cInfo.colorAttachments.length).fill({}).map((_, I)=>{
            return {
                loadOp: V.VK_ATTACHMENT_LOAD_OP_CLEAR,
                storeOp: V.VK_ATTACHMENT_STORE_OP_STORE,
                imageLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                clearValue: new Uint32Array([0, 0, 0, 0]),
                ...cInfo.colorAttachments[I].dynamicState
            };
        });

        //
        this.depthAttachmentDynamicRenderInfo = {
            loadOp: V.VK_ATTACHMENT_LOAD_OP_CLEAR,
            storeOp: V.VK_ATTACHMENT_STORE_OP_STORE,
            imageLayout: V.VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL,
            clearValue: {depth: 1.0, stencil: 0},
            ...(cInfo.depthAttachment?.dynamicState||{})
        };

        //
        this.stencilAttachmentDynamicRenderInfo = {
            loadOp: V.VK_ATTACHMENT_LOAD_OP_CLEAR,
            storeOp: V.VK_ATTACHMENT_STORE_OP_STORE,
            imageLayout: V.VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL,
            clearValue: {depth: 1.0, stencil: 0},
            ...(cInfo.stencilAttachment?.dynamicState||{})
        };
    }
}

//
class FramebufferObj extends B.BasicObj {
    constructor(base, cInfo){
        super(base, null); this.cInfo = cInfo;
        this.handle = new BigUint64Array([0n]);
        this.handle[0] = this.handle.address();
        B.Handles[this.handle[0]] = this;

        //
        const deviceObj = B.Handles[this.base[0]];
        const descriptorsObj = deviceObj.Descriptors[this.cInfo.pipelineLayout[0] || this.cInfo.pipelineLayout];
        const framebufferLayoutObj = B.Handles[(this.cInfo.framebufferLayout ? this.cInfo.framebufferLayout[0] : null) || this.cInfo.framebufferLayout] || B.DefaulFramebufferLayoutObj;

        //
        let extent = {width: Math.max(cInfo.extent.width || 2, 2), height: Math.max(cInfo.extent.height || 2, 2), depth: cInfo.extent.depth || 1};

        //
        this.colorImages = framebufferLayoutObj.colorFormats.map((F)=>(deviceObj.createImage({
            format: F, usage: V.VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | V.VK_IMAGE_USAGE_SAMPLED_BIT | V.VK_IMAGE_USAGE_STORAGE_BIT, extent,
        })));

        //
        this.colorImageViews = this.colorImages.map((IMG)=>(IMG.createImageView({
            pipelineLayout: descriptorsObj.handle[0],
            subresourceRange: { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: 1, baseArrayLayer: 0, layerCount: 1 }
        })));

        console.log(this.colorImageViews);

        //
        if (framebufferLayoutObj.depthFormat || framebufferLayoutObj.stencilFormat) {
            //
            this.depthStencilImage = deviceObj.createImage({
                format: framebufferLayoutObj.depthFormat, usage: V.VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT | V.VK_IMAGE_USAGE_SAMPLED_BIT, extent,
            });

            //
            this.depthStencilImageView = this.depthStencilImage.createImageView({
                pipelineLayout: descriptorsObj.handle[0],
                subresourceRange: { aspectMask: V.VK_IMAGE_ASPECT_DEPTH_BIT, baseMipLevel: 0, levelCount: 1, baseArrayLayer: 0, layerCount: 1 }
            });
        }

        


        //
        this.colorToAttachmentTemplate = {
            srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            srcSccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
            dstAccessMask: V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
            oldLayout: V.VK_IMAGE_LAYOUT_GENERAL,
            newLayout: V.VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        //
        this.colorToGeneralTemplate = {
            srcStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
            srcAccessMask:  V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
            oldLayout: V.VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL,
            newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        // 
        this.colorFromUndefinedTemplate = {
            srcStageMask: V.VK_PIPELINE_STAGE_2_NONE,
            srcAccessMask: V.VK_ACCESS_2_NONE,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_WRITE_BIT | V.VK_ACCESS_2_COLOR_ATTACHMENT_READ_BIT,
            oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
            newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
        };

        
        if (framebufferLayoutObj.depthFormat || framebufferLayoutObj.stencilFormat) {
            this.depthStencilToAttachment = new V.VkImageMemoryBarrier2({
                srcStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                srcAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                dstStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
                dstAccessMask: V.VK_ACCESS_2_DEPTH_STENCIL_ATTACHMENT_READ_BIT | V.VK_ACCESS_2_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                newLayout: V.VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL,
                image: this.depthStencilImage.handle[0],
                srcQueueFamilyIndex: ~0,
                dstQueueFamilyIndex: ~0,
                subresourceRange: this.depthStencilImageView.imageViewInfo.subresourceRange
            });

            this.depthStencilToGeneral = new V.VkImageMemoryBarrier2({
                srcStageMask: V.VK_PIPELINE_STAGE_2_COLOR_ATTACHMENT_OUTPUT_BIT,
                srcAccessMask: V.VK_ACCESS_2_DEPTH_STENCIL_ATTACHMENT_READ_BIT | V.VK_ACCESS_2_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT,
                dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL,
                newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                image: this.depthStencilImage.handle[0],
                srcQueueFamilyIndex: ~0,
                dstQueueFamilyIndex: ~0,
                subresourceRange: this.depthStencilImageView.imageViewInfo.subresourceRange
            });

            this.depthStencilFromUndefined = new V.VkImageMemoryBarrier2({
                srcStageMask: V.VK_PIPELINE_STAGE_2_NONE,
                srcAccessMask: V.VK_ACCESS_2_NONE,
                dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT | V.VK_ACCESS_2_DEPTH_STENCIL_ATTACHMENT_READ_BIT | V.VK_ACCESS_2_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT,
                oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
                newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                image: this.depthStencilImage.handle[0],
                srcQueueFamilyIndex: ~0,
                dstQueueFamilyIndex: ~0,
                subresourceRange: this.depthStencilImageView.imageViewInfo.subresourceRange
            });
        }

    }

    cmdFromUndefined(cmdBuf) {
        const imageBarriers = new V.VkImageMemoryBarrier2(this.colorImages.map((IMG, I)=>({...this.colorFromUndefinedTemplate, image: IMG.handle[0], subresourceRange: this.colorImageViews[I].imageViewInfo.subresourceRange})));
        if (this.depthStencilImageView) {
            V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: 1, pImageMemoryBarriers: this.depthStencilFromUndefined }));
        }
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: imageBarriers.length, pImageMemoryBarriers: imageBarriers }));
    }

    cmdToGeneral(cmdBuf) {
        const imageBarriers = new V.VkImageMemoryBarrier2(this.colorImages.map((IMG, I)=>({...this.colorToGeneralTemplate, image: IMG.handle[0], subresourceRange: this.colorImageViews[I].imageViewInfo.subresourceRange})));
        if (this.depthStencilImageView) {
            V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: 1, pImageMemoryBarriers: this.depthStencilToGeneral }));
        }
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: imageBarriers.length, pImageMemoryBarriers: imageBarriers }));
    }

    cmdToAttachment(cmdBuf) {
        const imageBarriers = new V.VkImageMemoryBarrier2(this.colorImages.map((IMG, I)=>({...this.colorToAttachmentTemplate, image: IMG.handle[0], subresourceRange: this.colorImageViews[I].imageViewInfo.subresourceRange})));
        if (this.depthStencilImageView) {
            V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: 1, pImageMemoryBarriers: this.depthStencilToAttachment }));
        }
        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: imageBarriers.length, pImageMemoryBarriers: imageBarriers }));
    }
}

//
B.FramebufferLayoutObj = FramebufferLayoutObj;
B.FramebufferObj = FramebufferObj;

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
export default { FramebufferLayoutObj, DefaulFramebufferLayoutObj, FramebufferObj };
