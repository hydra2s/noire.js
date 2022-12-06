import { default as V } from "./deps/vulkan.node.js/index.js"
import fs from "fs";
import { read, write, KTX2Container } from 'ktx-parse';
import { default as HDR } from 'hdr';

//
const XYZtoRGB = ([X, Y, Z]) => {
    //X, Y and Z input refer to a D65/2° standard illuminant.
    //sR, sG and sB (standard RGB) output range = 0 ÷ 255
    let var_R = X *  3.2406 + Y * -1.5372 + Z * -0.4986
    let var_G = X * -0.9689 + Y *  1.8758 + Z *  0.0415
    let var_B = X *  0.0557 + Y * -0.2040 + Z *  1.0570
    return [var_R, var_G, var_B].map(n => n > 0.0031308 ? 1.055 * Math.pow(n, (1 / 2.4)) - 0.055 : 12.92 * n)
}

(async()=>{
    const hdrloader = new HDR.loader();
    await new Promise(async (r,rj)=>{
        
        fs.createReadStream("background.hdr").pipe(hdrloader.on('load', async function() {
            const image = this;

            // covnert into fp16 + RGB from XYZ
            const fp16data = new Uint16Array(image.width*image.height*4); const fp16address = fp16data.address();
            const fp32data = new Float32Array(8);                         const fp32address = fp32data.address();
            for (let I=0;I<image.width*image.height;I+=2) {
                fp32data.set([
                    ...XYZtoRGB(image.data.subarray(I*3+0, I*3+3)), 1.0, 
                    ...XYZtoRGB(image.data.subarray(I*3+3, I*3+6)), 1.0
                ]);

                // make operation bit faster, due priority in native code
                V.convertF32toF16x8(fp16address + BigInt(I)*8n, fp32address);
            }

            //
            const container = new KTX2Container();
            container.vkFormat = V.VK_FORMAT_R16G16B16A16_SFLOAT;
            container.pixelWidth = image.width;
            container.pixelHeight = image.height;
            container.pixelDepth = 1;
            container.layerCount = 1;
            container.faceCount = 1;
            container.levels = [
                {
                    levelData: new Uint8Array(fp16data.buffer, fp16data.byteOffset, fp16data.byteLength), 
                    uncompressedByteLength: fp16data.byteLength
                }
            ];

            //
            await fs.promises.writeFile("background.ktx2", write(container));

            r(1);
        }));
    });
})();