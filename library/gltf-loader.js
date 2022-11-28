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
    $address: "u64",
    geometryCount: "u32",
    flags: "u32",
}));

//
const nrGeometry = new Proxy(V.CStructView, new V.CStruct("nrGeometry", {
    vertex: "nrBinding",
    indice: "nrBinding",
    normal: "nrBinding",
    colors: "nrBinding",
    tangent: "nrBinding",
    texcoord: "nrBinding",
    primitiveCount: "u32",
    _: "u32",
    materialAddress: "u64"
}));

// in top level of AS
const nrNode = new Proxy(V.CStructView, new V.CStruct("nrNode", {
    transform: "f32[12]",
    //accStruct: "u64",
    meshBuffer: "u64"
}));

//
const nrTexBinding = new Proxy(V.CStructView, new V.CStruct("nrTexBinding", {
    col: "f32[4]", tex: "i32", _: "u32"
}));

//
const nrMaterial = new Proxy(V.CStructView, new V.CStruct("nrMaterial", {
    diffuse: "nrTexBinding",
    normal: "nrTexBinding",
    PBR: "nrTexBinding",
}));

//
class GltfLoaderObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;
    }

    async load(file, relative = "./") {
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

            case ".bin":
            parsedData = await fs.promises.readFile(file);
            break;

            case ".hdr":
            case ".png":
            case ".jpg":
            case ".ktx":
            case ".ktx2":
            parsedData = await this.textureLoader.load(file, relative)
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

        // 
        await Promise.all(rawData.buffers.map(async ($B)=>{
            const buffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: $B.byteLength }));
            const bufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: $B.byteLength }));

            //
            buffers.push(buffer);
            buffersGPU.push(bufferGPU);

            //
            buffer.map().set(await this.load($B.uri));
            buffer.unmap();

            //
            await B.awaitFenceAsync(deviceObj.handle[0], deviceObj.submitOnce({
                queueFamilyIndex: 0,
                queueIndex: 0,
                cmdBufFn: (cmdBuf)=>{
                    buffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, bufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: $B.byteLength }]);
                }
            }));
        }));

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

        // TODO: samplers support


        //
        rawData.materials.map((M)=>{
            const material = {}; materials.push(material);
            material.diffuse = {
                tex: textureDescIndices[M.pbrMetallicRoughness.baseColorTexture.index] || -1,
                col: [0.0, 0.0, 0.0, 1.0]
            }
        });

        //
        const materialData = new nrMaterial(materials);
        materialBuffer.map().set(materialData.buffer);
        materialBuffer.unmap();

        //
        await B.awaitFenceAsync(deviceObj.handle[0], deviceObj.submitOnce({
            queueFamilyIndex: 0,
            queueIndex: 0,
            cmdBufFn: (cmdBuf)=>{
                materialBuffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, materialBufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: materialData.byteLength }]);
            }
        }));

        //
        const meshBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: nrMesh.byteLength * rawData.meshes.length }));
        const meshBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: nrMesh.byteLength * rawData.meshes.length }));

        //
        const geometryBuffers = [];
        const geometryBuffersGPU = [];

        //
        await Promise.all(rawData.meshes.map(async (M,K)=>{
            const mesh = { geometries: [], geometryCount: 0 }; meshes.push(mesh);

            //
            mesh.geometries = M.primitives.map((P)=>{
                const geometryId = geometries.length;
                geometries.push({
                    vertex: bindings[P.attributes["POSITION"]],
                    normal: bindings[P.attributes["NORMAL"]],
                    tangent: bindings[P.attributes["TANGENT"]],
                    texcoord: bindings[P.attributes["TEXCOORD_0"]],
                    indice: bindings[P.indices],
                    primitiveCount: (bindings[P.indices]?.length || bindings[P.attributes["POSITION"]]?.length || 3) / 3,
                    materialAddress: materialBufferGPU.getDeviceAddress() + BigInt(nrMaterial.byteLength * P.material)
                });

                //
                mesh.geometryCount++;
                return geometryId;
            });

            // TODO: unified geometry buffer
            const geometryBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: nrGeometry.byteLength * mesh.geometryCount }));
            const geometryBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: nrGeometry.byteLength * mesh.geometryCount }));

            // TODO: optimize accesses
            const geometriesData = new nrGeometry(mesh.geometryCount);
            mesh.geometries.map((I,L)=>(geometriesData[L] = geometries[I]));
            geometryBuffer.map().set(geometriesData.buffer);
            geometryBuffer.unmap();

            // TODO: optimize accesses
            const meshInfo = new nrMesh({ geometryCount: mesh.geometryCount, $address: geometryBufferGPU.getDeviceAddress() });
            meshBuffer.map().set(meshInfo.buffer, nrMesh.byteLength*K);
            meshBuffer.unmap();

            // TODO: unified geometry buffer
            geometryBuffers.push(geometryBuffer);
            geometryBuffersGPU.push(geometryBufferGPU);

            //
            const asGeometries = mesh.geometries.map((G,I)=>({
                opaque: true,
                primitiveCount: geometries[G].primitiveCount,
                geometry: {
                    indexData: geometries[G].index?.$address,
                    indexType: geometries[G].index?.$address ? (is16bit(geometries[G].index.format) ? V.VK_INDEX_TYPE_UINT16 : V.VK_INDEX_TYPE_UINT32) : V.VK_INDEX_TYPE_NONE_KHR,
                    vertexFormat: V.VK_FORMAT_R32G32B32_SFLOAT, // currently, only supported FVEC3
                    vertexData: geometries[G].vertex?.$address,
                    vertexStride: geometries[G].vertex.stride,
                    maxVertex: geometries[G].vertex.length
                }
            }));

            //
            const bottomLevel = deviceObj.createBottomLevelAccelerationStructure({
                geometries: asGeometries
            });

            //
            await B.awaitFenceAsync(deviceObj.handle[0], deviceObj.submitOnce({
                queueFamilyIndex: 0,
                queueIndex: 0,
                cmdBufFn: (cmdBuf)=>{
                    geometryBuffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, geometryBufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: geometriesData.byteLength }]);
                    bottomLevel.cmdBuild(cmdBuf, mesh.geometries.map((G,I)=>({
                        primitiveCount: G.primitiveCount,
                        primitiveOffset: 0,
                        firstVertex: 0,
                        transformOffset: 0
                    })));
                }
            }));

            //
            mesh.meshDeviceAddress = meshBufferGPU.getDeviceAddress() + BigInt(mesh.meshByteOffset = nrMesh.byteLength*K);
            mesh.accelerationStructure = bottomLevel;
        }));

        // commit mesh buffers
        await B.awaitFenceAsync(deviceObj.handle[0], deviceObj.submitOnce({
            queueFamilyIndex: 0,
            queueIndex: 0,
            cmdBufFn: (cmdBuf)=>{
                meshBuffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, meshBufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: nrMesh.byteLength * rawData.meshes.length }]);
            }
        }));

        // TODO: implement nodes of GLTF, top levels of AS
        const parseNode = (node, matrix)=>{
            let $node = [];
            if (node.children) {
                $node = [...$node, ...node.children.map((idx)=>{
                    return parseNode(rawData.nodes[idx], matrix);
                })];
            } else {
                $node = [{
                    instance: {
                        "transform:f32[12]": [1.0, 0.0, 0.0, 0.0,  0.0, 1.0, 0.0, 0.0,  0.0, 0.0, 1.0, 0.0],
                        instanceCustomIndex: 0,
                        mask: 0xFF,
                        instanceShaderBindingTableRecordOffset: 0,
                        flags: 0,
                        accelerationStructureReference: meshes[node.mesh].accelerationStructure.getDeviceAddress()
                    },
                    node: {
                        "transform:f32[12]": [1.0, 0.0, 0.0, 0.0,  0.0, 1.0, 0.0, 0.0,  0.0, 0.0, 1.0, 0.0],
                        meshBuffer: meshes[node.mesh].meshDeviceAddress
                    }
                }];
            }
            return $node;
        };

        // only single instanced data supported
        const instancedData = parseNode(rawData.nodes[rawData.scenes[0].nodes[0]], new Float32Array([
            1.0, 0.0, 0.0, 0.0,  
            0.0, 1.0, 0.0, 0.0,  
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        ]));

        //
        return {
            instancedData,
            geometryBuffers,
            geometryBuffersGPU,
            meshBuffer,
            meshBufferGPU,
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
