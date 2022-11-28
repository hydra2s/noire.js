import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";
import { default as bmp } from "bmp-js";
import { default as gm } from "gm";
import path from 'path';
import fs from 'fs';
import { read, write } from 'ktx-parse';

//
const gmi = gm.subClass({imageMagick: true});

//
class TextureLoaderObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
    }

    async load(file) {
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];
        const ext = path.extname(file);
        let parsedData = null;

        switch(ext) {
            case ".bmp": {
                const bmpData = bmp.decode(await fs.promises.readFile(file));
                const texImage = memoryAllocatorObj.allocateMemory({ isDevice: true, isHost: false }, deviceObj.createImage({ extent: {width: bmpData.width, height: bmpData.height, depth: 1}, format: V.VK_FORMAT_A8B8G8R8_UNORM_PACK32, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                const texBuf = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: bmpData.width * bmpData.height * bmpData.bitPP * 4 }));
                texBuf.map().set(bmpData.data);
                texBuf.unmap();

                //
                const subresource = { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: 1, baseArrayLayer: 0, layerCount: 1 };
                const texBarrier = new V.VkImageMemoryBarrier2({
                    srcStageMask: V.VK_PIPELINE_STAGE_2_NONE,
                    srcAccessMask: V.VK_ACCESS_2_NONE,
                    dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                    dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                    oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
                    newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                    image: texImage.handle[0],
                    subresourceRange: subresource,
                });

                //
                deviceObj.submitOnce({
                    queueFamilyIndex: 0,
                    queueIndex: 0,
                    cmdBufFn: (cmdBuf)=>{
                        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: texBarrier.length, pImageMemoryBarriers: texBarrier }));
                        texBuf.cmdCopyToImage(cmdBuf[0]||cmdBuf, texImage.handle[0], [{ imageExtent: {width: bmpData.width, height: bmpData.height, depth: 1} }]);
                    }
                });

                //
                r(deviceObj.createImageView({
                    image: texImage.handle[0],
                    format : texImage.cInfo.format,
                    pipelineLayout: this.cInfo.pipelineLayout,
                    subresourceRange: subresource
                }).DSC_ID);
            }
            break;

            case ".png":
            case ".jpg":
            case ".jng":
            parsedData = await new Promise((r,rj)=>{
                gmi(file).toBuffer('BMP', (err, buffer) => {
                    const bmpData = bmp.decode(buffer);
                    const texImage = memoryAllocatorObj.allocateMemory({ isDevice: true, isHost: false }, deviceObj.createImage({ extent: {width: bmpData.width, height: bmpData.height, depth: 1}, format: V.VK_FORMAT_A8B8G8R8_UNORM_PACK32, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                    const texBuf = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: bmpData.width * bmpData.height * bmpData.bitPP * 4 }));
                    texBuf.map().set(bmpData.data);
                    texBuf.unmap();

                    //
                    const subresource = { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: 1, baseArrayLayer: 0, layerCount: 1 };
                    const texBarrier = new V.VkImageMemoryBarrier2({
                        srcStageMask: V.VK_PIPELINE_STAGE_2_NONE,
                        srcAccessMask: V.VK_ACCESS_2_NONE,
                        dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                        dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                        oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
                        newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                        image: texImage.handle[0],
                        subresourceRange: subresource,
                    });

                    //
                    deviceObj.submitOnce({
                        queueFamilyIndex: 0,
                        queueIndex: 0,
                        cmdBufFn: (cmdBuf)=>{
                            V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: texBarrier.length, pImageMemoryBarriers: texBarrier }));
                            texBuf.cmdCopyToImage(cmdBuf[0]||cmdBuf, texImage.handle[0], [{ imageExtent: {width: bmpData.width, height: bmpData.height, depth: 1} }]);
                        }
                    });

                    //
                    r(deviceObj.createImageView({
                        image: texImage.handle[0],
                        format : texImage.cInfo.format,
                        pipelineLayout: this.cInfo.pipelineLayout,
                        subresourceRange: subresource
                    }).DSC_ID);
                })
            });
            break;

            case "ktx2":
            case "ktx":
            {
                const container = read(await fs.promises.readFile(file));
                const texImage = memoryAllocatorObj.allocateMemory({ isDevice: true, isHost: false }, deviceObj.createImage({ extent: { width: container.pixelWidth, height: container.pixelHeight, depth: container.pixelDepth }, arrayLayers: container.layerCount, format: container.vkFormat, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                const texBuf = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: container.pixelWidth * container.pixelHeight * container.pixelDepth * container.typeSize }));
                texBuf.map().set(container.levels[0].levelData);
                texBuf.unmap();

                //
                const subresource = { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: 1, baseArrayLayer: 0, layerCount: container.layerCount };
                const texBarrier = new V.VkImageMemoryBarrier2({
                    srcStageMask: V.VK_PIPELINE_STAGE_2_NONE,
                    srcAccessMask: V.VK_ACCESS_2_NONE,
                    dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
                    dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
                    oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
                    newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
                    image: texImage.handle[0],
                    subresourceRange: subresource,
                });

                //
                deviceObj.submitOnce({
                    queueFamilyIndex: 0,
                    queueIndex: 0,
                    cmdBufFn: (cmdBuf)=>{
                        V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: texBarrier.length, pImageMemoryBarriers: texBarrier }));
                        texBuf.cmdCopyToImage(cmdBuf[0]||cmdBuf, texImage.handle[0], [{ imageExtent: { width: container.pixelWidth, height: container.pixelHeight, depth: container.pixelDepth } }]);
                    }
                });

                //
                r(deviceObj.createImageView({
                    image: texImage.handle[0],
                    format : texImage.cInfo.format,
                    pipelineLayout: this.cInfo.pipelineLayout,
                    subresourceRange: subresource
                }).DSC_ID);
            }
            break;
        }

        return parsedData;
    }
}

//
B.TextureLoaderObj = TextureLoaderObj;
export default { TextureLoaderObj };
