import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";
import path from 'path';
import fs from 'fs';
import { read, write } from 'ktx-parse';

//
import { default as HDR } from 'hdr';

// best performance
import { default as sharp } from 'sharp';

//
import {
    Float16Array, isFloat16Array, isTypedArray,
    getFloat16, setFloat16,
    hfround,
} from "@petamoriken/float16";

//
//const gmi = gm.subClass({imageMagick: true});

//
const XYZtoRGB = ([X, Y, Z]) => {
    //X, Y and Z input refer to a D65/2° standard illuminant.
    //sR, sG and sB (standard RGB) output range = 0 ÷ 255
    let var_R = X *  3.2406 + Y * -1.5372 + Z * -0.4986
    let var_G = X * -0.9689 + Y *  1.8758 + Z *  0.0415
    let var_B = X *  0.0557 + Y * -0.2040 + Z *  1.0570
    return [var_R, var_G, var_B].map(n => n > 0.0031308 ? 1.055 * Math.pow(n, (1 / 2.4)) - 0.055 : 12.92 * n)
}

//
class TextureLoaderObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
        this.hdrloader = new HDR.loader();
    }

    // Resizable BAR for textures was failed
    // TODO! Also, planned multi-threading support (by workers with shared data, and different queues)
    // With MT upload performance should to increase up to 10-20% additionally.
    // TODO! Native Linear or sRGB support, without in-shader conversion...
    async load(file, relative = "./") {
        // for textures re-bar isn't available
        const reBAREnabled = false;

        // uploading may to be faster
        const reBARUpstream = true;

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];
        const ext = path.extname(file);

        //
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

            // Very bad performance, not recommended...
            case ".hdr":
            status = await new Promise(async (r,rj)=>{
                fs.createReadStream(relative + file).pipe(this.hdrloader.on('load', async function() {
                    const image = this;

                    // TODO: decide, what is BAR or/and Device memory
                    texImage = memoryAllocatorObj.allocateMemory({ isHost: reBAREnabled, isDevice: true }, deviceObj.createImage({ extent: {width: image.width, height: image.height, depth: 1}, format: V.VK_FORMAT_R16G16B16A16_SFLOAT, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));

                    //
                    texBuf = reBAREnabled ? texImage : memoryAllocatorObj.allocateMemory({ isHost: true, isDevice: reBARUpstream }, deviceObj.createBuffer({ size: image.width * image.height * 8 }));

                    // covnert into fp16 + RGB from XYZ
                    const fp16data = new Uint16Array(image.width*image.height*4); const fp16address = texBuf.map().address();
                    const fp32data = new Float32Array(8);                         const fp32address = fp32data.address();
                    for (let I=0;I<image.width*image.height;I+=2) {
                        fp32data.set([
                            ...XYZtoRGB(image.data.subarray(I*3+0, I*3+3)), 1.0, 
                            ...XYZtoRGB(image.data.subarray(I*3+3, I*3+6)), 1.0
                        ]);

                        // make operation bit faster, due priority in native code
                        V.convertF32toF16x8(fp16address + BigInt(I)*8n, fp32address);
                    }

                    r(1);
                }));
            });
            break;

            // most preferred
            case ".ktx2":
            case ".ktx":
            status = await new Promise(async(r,rj)=>{
                const container = read(await fs.promises.readFile(relative + file));

                //console.log(JSON.stringify(container.dataFormatDescriptorm, null, 4));

                // TODO: decide, what is BAR or/and Device memory
                texImage = memoryAllocatorObj.allocateMemory({ isHost: reBAREnabled, isDevice: true }, deviceObj.createImage({ extent: { width: container.pixelWidth, height: container.pixelHeight, depth: container.pixelDepth||1 }, mipLevels: container.levels.length, arrayLayers: container.layerCount, format: container.vkFormat, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                subresource = { aspectMask: V.VK_IMAGE_ASPECT_COLOR_BIT, baseMipLevel: 0, levelCount: container.levels.length || 1, baseArrayLayer: 0, layerCount: container.layerCount||1 };

                // TODO: all mip levels support
                texBuf = reBAREnabled ? texImage : memoryAllocatorObj.allocateMemory({ isHost: true, isDevice: reBARUpstream }, deviceObj.createBuffer({ size: container.levels[0].uncompressedByteLength }));
                V.memcpy(texBuf.map().address(), container.levels[0].levelData.address(), container.levels[0].levelData.byteLength);
                texBuf.unmap();

                r(1);
            });
            break;

            // determination!
            default:
            status = await new Promise(async(r,rj)=>{
                const { data, info } = await sharp(relative + file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                {
                    // TODO: decide, what is BAR or/and Device memory
                    texImage = memoryAllocatorObj.allocateMemory({ isHost: reBAREnabled, isDevice: true }, deviceObj.createImage({ extent: {width: info.width, height: info.height, depth: 1}, format: V.VK_FORMAT_R8G8B8A8_UNORM, usage: V.VK_IMAGE_USAGE_SAMPLED_BIT }));
                    componentMapping = { x: V.VK_COMPONENT_SWIZZLE_R, g: V.VK_COMPONENT_SWIZZLE_G, b: V.VK_COMPONENT_SWIZZLE_B, a: V.VK_COMPONENT_SWIZZLE_A };

                    //
                    texBuf = reBAREnabled ? texImage : memoryAllocatorObj.allocateMemory({ isHost: true, isDevice: reBARUpstream }, deviceObj.createBuffer({ size: info.width * info.height * 4 }));
                    V.memcpy(texBuf.map().address(), data.address(), data.byteLength);
                    texBuf.unmap();

                    //
                    r(1);
                }
            });
            break;
        }

        //
        const texBarrier = new V.VkImageMemoryBarrier2({
            srcStageMask: reBAREnabled ? V.VK_PIPELINE_STAGE_2_HOST_BIT : V.VK_PIPELINE_STAGE_2_NONE,
            srcAccessMask: reBAREnabled ? (V.VK_ACCESS_2_HOST_READ_BIT | V.VK_ACCESS_2_HOST_WRITE_BIT) : V.VK_ACCESS_2_NONE,
            dstStageMask: V.VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT,
            dstAccessMask: V.VK_ACCESS_2_MEMORY_WRITE_BIT | V.VK_ACCESS_2_MEMORY_READ_BIT | V.VK_ACCESS_2_SHADER_WRITE_BIT | V.VK_ACCESS_2_SHADER_READ_BIT,
            oldLayout: V.VK_IMAGE_LAYOUT_UNDEFINED,
            newLayout: V.VK_IMAGE_LAYOUT_GENERAL,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
            image: texImage.handle[0],
            subresourceRange: subresource,
        });

        //
        // TODO: add semaphore per threads
        const fence = deviceObj.submitOnce({
            manualFence: true,
            queueFamilyIndex: 0,
            queueIndex: 0,
            cmdBufFn: (cmdBuf)=>{
                V.vkCmdPipelineBarrier2(cmdBuf[0]||cmdBuf, new V.VkDependencyInfoKHR({ imageMemoryBarrierCount: texBarrier.length, pImageMemoryBarriers: texBarrier }));

                // TODO: multiple mip support
                if (!reBAREnabled) {
                    texBuf.cmdCopyToImage(cmdBuf[0]||cmdBuf, texImage.handle[0], [{ 
                        imageExtent: texImage.cInfo.extent,
                        imageSubresource: { aspectMask: subresource.aspectMask, mipLevel: subresource.baseMipLevel, baseArrayLayer: subresource.baseArrayLayer, layerCount:subresource.layerCount }
                    }]);
                }
            }
        });

        //
        const promised = B.awaitFenceAsync(deviceObj.handle[0], fence);

        // TODO: remove host buffer when No Resiable BAR enabled (`texBuf`)
        promised.then(async (status)=>{
            const fn = fence[0]; fence[0] = 0n; V.vkDestroyFence(deviceObj.handle[0], fence[0], null);
        });

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
