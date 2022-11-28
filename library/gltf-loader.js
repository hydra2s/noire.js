import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";
import path from 'path';
import fs from 'fs';
import { default as L } from "./texture-loader.js"

//
const nrBinding = new Proxy(V.CStructView, new V.CStruct("nrBinding", {
    $address: "u64",
    length: "u32",
    range: "u32",
    stride: "u32",
    format: "u32"
}));

// bottom level of AS
const nrMesh = new Proxy(V.CStructView, new V.CStruct("nrMesh", {
    $address: "64",
    geometryCount: "u32",
    flags: "u32"
}));

//
const nrGeometry = new Proxy(V.CStructView, new V.CStruct("nrGeometry", {
    vertex: nrBinding,
    indice: nrBinding,
    normal: nrBinding,
    colors: nrBinding,
    tangent: nrBinding,
    texcoord: nrBinding,
    primitiveCount: "u32",
    materialAddress: "u32"
}));

// in top level of AS
const nrInstance = new Proxy(V.CStructView, new V.CStruct("nrInstance", {
    transform: "f32[12]",
    accStruct: "u64",
    
}));

//
const nrMaterial = new Proxy(V.CStructView, new V.CStruct("nrMaterial", {
    diffuseTex: "u32"
}));

//
class GltfLoaderObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
    }

    async load(file) {
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];
        const ext = path.extname(file);
        let parsedData = null;

        //
        this.textureLoader = new B.TextureLoaderObj(this.base, this.cInfo);

        //
        switch(ext) {
            case ".gltf":
            parsedData = this.parse(await fs.promises.readFile(file));
            break;
            
            case ".png":
            case ".jpg":
            case ".ktx":
            case ".ktx2":
            parsedData = await this.textureLoader.load(file)
            break;
        }

        return parsedData;
    }

    async parse(gltf) {
        const rawData = JSON.parse(gltf);
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];

        //
        const materialBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: nrMaterial.byteLength * rawData.materials.length }));
        const materialBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: nrMaterial.byteLength * rawData.materials.length }));
        const buffersGPU = [];
        const buffers = [];
        const bindings = [];

        // TODO: fill buffers
        rawData.buffers.map((B)=>{
            buffers.push(memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: B.byteLength })));
            buffersGPU.push(memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: B.byteLength })));

            
        });

        //
        rawData.accessors.map((A)=>{
            const B = rawData.bufferViews[A.bufferView];

            //
            let Bs = 4;
            if (A.componentType == 5126) { Bs = 4 };
            if (A.componentType == 5123) { Bs = 2 };

            //
            if (A.type == "VEC2") Bs *= 2;
            if (A.type == "VEC3") Bs *= 3;
            if (A.type == "VEC4") Bs *= 4;

            //
            const _bstride = A.byteStride || B.byteStride || Bs;
            const _blength = A.byteLength || B.byteLength;

            //
            bindings.push({
                $address: buffersGPU[B.buffer].getDeviceAddress() + BigInt(A?.byteOffset||0) + BigInt(B?.byteOffset||0),
                length: _blength / _bstride,
                range: _blength,
                stride: _bstride
            });
        });

        // 
        const textureDescIndices = new Array(rawData.images.length).fill(-1);
        const samplerDescIndices = [];

        // 
        const meshes = []; // bottom levels
        const nodes = []; // top levels
        const materials = []; //
        const geometries = [];

        //
        await Promise.all(rawData.images.map(async (I, L)=>{
            textureDescIndices[L] = await this.load(I.uri);
            
        }));

        //console.log(textureDescIndices);

        //
        rawData.materials.map((M)=>{
            const material = {}; materials.push(material);
        });

        //
        rawData.meshes.map((M)=>{
            const mesh = { geometries: [], geometryCount: 0 }; meshes.push(mesh);

            //
            M.primitives.map((P)=>{

                //
                const geometryId = geometries.length;
                geometries.push({
                    vertex: bindings[P.attributes["POSITION"]],
                    normal: bindings[P.attributes["NORMAL"]],
                    tangent: bindings[P.attributes["TANGENT"]],
                    texcoord: bindings[P.attributes["TEXCOORD_0"]],
                    indice: bindings[P.indices],
                    primitiveCount: (bindings[P.indices]?.length || bindings[P.attributes["POSITION"]]?.length || 3) / 3,
                    material: materialBufferGPU.getDeviceAddress() + BigInt(nrMaterial.byteLength * rawData.materials.length)
                });

                //
                mesh.geometries.push(geometryId);
                mesh.geometryCount++;
            });
        });

        //
        return {
            textureDescIndices,
            samplerDescIndices, 
            materials,
            nodes,
            meshes,
            materialBuffer,
            materialBufferGPU,
            buffersGPU,
            buffers, 
            bindings,
            geometries
        }
    }
}

//
B.GltfLoaderObj = GltfLoaderObj;
export default { GltfLoaderObj };
