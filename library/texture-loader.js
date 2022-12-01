import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";
import { default as bmp } from "bmp-js";
import { default as gm } from "gm";
import path from 'path';
import fs from 'fs';
import { read, write } from 'ktx-parse';
import { default as HDR } from 'hdr';
import { PNG } from 'pngjs';
import { default as Jimp } from 'jimp';

//
import {
    Float16Array, isFloat16Array, isTypedArray,
    getFloat16, setFloat16,
    hfround,
} from "@petamoriken/float16";

//
const gmi = gm.subClass({imageMagick: true});

//
const XYZtoRGB = ([X, Y, Z]) => {
    //X, Y and Z input refer to a D65/2° standard illuminant.
    //sR, sG and sB (standard RGB) output range = 0 ÷ 255
    let var_R = var_X *  3.2406 + var_Y * -1.5372 + var_Z * -0.4986
    let var_G = var_X * -0.9689 + var_Y *  1.8758 + var_Z *  0.0415
    let var_B = var_X *  0.0557 + var_Y * -0.2040 + var_Z *  1.0570
    return [var_R, var_G, var_B].map(n => n > 0.0031308 ? 1.055 * Math.pow(n, (1 / 2.4)) - 0.055 : 12.92 * n)
}

//
class TextureLoaderObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.hdrloader = new HDR.loader();
    }

    async load(file, relative = "./") {
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];
        const ext = path.extname(file);
        let parsedData = null;

        //
        let texImage = null;
        let texBuf = null;

        //
        let subresource = { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: 1, baseArrayLayer: 0, layerCount: 1 };
        let componentMapping = { x: V.VK_COMPONENT_SWIZZLE_R, g: V.VK_COMPONENT_SWIZZLE_G, b: V.VK_COMPONENT_SWIZZLE_B, a: V.VK_COMPONENT_SWIZZLE_A };

        //
        let status = 0;
        const self = this;
        switch(ext) {
            case ".hdr":
            status = new Promise(async (r,rj)=>{
                this.hdrloader.on('load', async function() {
                    const image = this;

                    // covnert into fp16 + RGB from XYZ
                    const fp16data = new Float16Array(image.width*image.height*4);
                    for (let I=0;I<image.width*image.height;I++) {
                        const pixel3f = XYZtoRGB(image.subarray(I*3, I*3+3));
                        fp16data.set([pixel3f[0], pixel3f[1], pixel3f[2], 1.0], I*4);
                    }

                    //
                    texImage = memoryAllocatorObj.allocateMemory({ isDevice: true, isHost: false }, deviceObj.createImage({ extent: {width: image.width, height: image.height, depth: 1}, format: V.VK_FORMAT_R16G16B16A16_SFLOAT, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                    
                    //
                    texBuf = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: image.width * image.height * 2 }));
                    texBuf.map().set(fp16data.buffer);
                    texBuf.unmap();

                    r(1);
                });
            });
            fs.createReadStream(relative + file).pipe(this.hdrloader);
            status = await status;
            break;

            case ".bmp":
            case ".jpg":
            case ".png": 
            status = await new Promise(async (r,rj)=>{
                Jimp.read(relative + file, (err, DATA)=>{
                    const image = DATA.bitmap;
                    texImage = memoryAllocatorObj.allocateMemory({ isDevice: true, isHost: false }, deviceObj.createImage({ extent: {width: image.width, height: image.height, depth: 1}, format: V.VK_FORMAT_R8G8B8A8_UNORM, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                    componentMapping = { x: V.VK_COMPONENT_SWIZZLE_R, g: V.VK_COMPONENT_SWIZZLE_G, b: V.VK_COMPONENT_SWIZZLE_B, a: V.VK_COMPONENT_SWIZZLE_A };

                    // 
                    texBuf = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: image.width * image.height * 4 }));
                    texBuf.map().set(image.data);
                    texBuf.unmap();
                    
                    //
                    r(1);
                });
            });
            break;
            
            case "ktx2":
            case "ktx":
            status = await new Promise(async(r,rj)=>{
                const container = read(await fs.promises.readFile(relative + file));
                texImage = memoryAllocatorObj.allocateMemory({ isDevice: true, isHost: false }, deviceObj.createImage({ extent: { width: container.pixelWidth, height: container.pixelHeight, depth: container.pixelDepth }, mipLevels: container.levels.length, arrayLayers: container.layerCount, format: container.vkFormat, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                subresource = { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: container.levels.length, baseArrayLayer: 0, layerCount: container.layerCount };

                // TODO: all mip levels support
                texBuf = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: container.levels[0].uncompressedByteLength }));
                texBuf.map().set(container.levels[0].levelData);
                texBuf.unmap();

                r(1);
            });
            break;

            default:
                status = await new Promise(async(r,rj)=>{
                gmi(relative + file).quality(0).toBuffer('PNG', async (err, buffer) => {
                    new PNG({}).parse(buffer, function (error, image) {
                        texImage = memoryAllocatorObj.allocateMemory({ isDevice: true, isHost: false }, deviceObj.createImage({ extent: {width: image.width, height: image.height, depth: 1}, format: V.VK_FORMAT_R8G8B8A8_UNORM, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                        componentMapping = { x: V.VK_COMPONENT_SWIZZLE_R, g: V.VK_COMPONENT_SWIZZLE_G, b: V.VK_COMPONENT_SWIZZLE_B, a: V.VK_COMPONENT_SWIZZLE_A };

                        //
                        texBuf = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: image.width * image.height * 4 }));
                        texBuf.map().set(image.data);
                        texBuf.unmap();

                        r(1);
                    });
                })
            });
            break;
        }

        //
        const texBarrier = new V.VkImageMemoryBarrier2({
            srcStageMask: V.VK_PIPELINE_STAGE_2_NONE,
            srcAccessMask: V.VK_ACCESS_2_NONE,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
            oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
            newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
            image: texImage.handle[0],
            subresourceRange: subresource,
        });

        //
        const imageFence = B.awaitFenceAsync(deviceObj.handle[0], deviceObj.submitOnce({
            queueFamilyIndex: 0,
            queueIndex: 0,
            cmdBufFn: (cmdBuf)=>{
                V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: texBarrier.length, pImageMemoryBarriers: texBarrier }));
                
                // TODO: multiple mip support
                texBuf.cmdCopyToImage(cmdBuf[0]||cmdBuf, texImage.handle[0], [{ 
                    imageExtent: texImage.cInfo.extent,
                    imageSubresource: { aspectMask: subresource.aspectMask, mipLevel: subresource.baseMipLevel, baseArrayLayer: subresource.baseArrayLayer, layerCount:subresource.layerCount }
                }]);
            }
        }));

        //
        parsedData = deviceObj.createImageView({
            image: texImage.handle[0],
            format : texImage.cInfo.format,
            pipelineLayout: this.cInfo.pipelineLayout,
            subresourceRange: subresource,
            components: componentMapping
        }).DSC_ID;

        //
        return parsedData;
    }
}

//
B.TextureLoaderObj = TextureLoaderObj;
export default { TextureLoaderObj };
