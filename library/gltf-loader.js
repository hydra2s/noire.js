import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";
import path from 'path';
import fs from 'fs';
import { default as L } from "./texture-loader.js"
import { default as $M } from "gl-matrix"
import {JSOX} from 'jsox'

//
const nrBinding = new Proxy(V.CStructView, new V.CStruct("nrBinding", {
    $address: "u64",
    $length: "u32",
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
    transform: "f32[16]",
    transformInverse: "f32[16]",
    meshBuffer: "u64",
    meshIndex: "u32",
    _: "u32"
}));

//
const nrTexBinding = new Proxy(V.CStructView, new V.CStruct("nrTexBinding", {
    col: "f32[4]", tex: "i16", sam: "i16"
}));

//
const nrMaterial = new Proxy(V.CStructView, new V.CStruct("nrMaterial", {
    diffuse: "nrTexBinding",
    normal: "nrTexBinding",
    PBR: "nrTexBinding",
    emissive: "nrTexBinding",
}));

//
const Formats = {
    eFloat: 0x0,
    eFloat2: 0x1,
    eFloat3: 0x2,
    eFloat4: 0x3,
    eHalf: 0x4,
    eHalf2: 0x5,
    eHalf3: 0x6,
    eHalf4: 0x7,
    eUint: 0x8,
    eUint2: 0x9,
    eUint3: 0xA,
    eUint4: 0xB,
    eShort: 0xC,
    eShort2: 0xD,
    eShort3: 0xE,
    eShort4: 0xF,
    eMat3x4: 0x1F,
    eNone: 0x100
}

//
const is16bit = (format)=>{
    return !!(format & 0x4);
}

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
            console.log(path.dirname(file));
            parsedData = this.parse(await fs.promises.readFile(file), path.dirname(file) + "/");
            break;

            case ".bin":
            parsedData = await fs.promises.readFile(relative + file);
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

    async parse(gltf, relative) {
        const rawData = JSON.parse(gltf);
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];

        //
        const materialBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: nrMaterial.byteLength * rawData.materials.length }));
        const materialBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: nrMaterial.byteLength * rawData.materials.length, usage: V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR }));
        const buffersGPU = new Array(rawData.buffers.length).fill({});
        const buffers = new Array(rawData.buffers.length).fill({});
        const bindings = [];

        // 
        await Promise.all(rawData.buffers.map(async ($B, K)=>{
            const buffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: $B.byteLength }));
            const bufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: $B.byteLength, usage: V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR | V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | V.VK_BUFFER_USAGE_VERTEX_BUFFER_BIT | V.VK_BUFFER_USAGE_INDEX_BUFFER_BIT }));

            //
            buffers[K] = buffer;
            buffersGPU[K] = bufferGPU;

            //
            buffer.map().set(await this.load($B.uri, relative));
            buffer.unmap();
        }));

        //
        rawData.accessors.map((A)=>{
            const B = rawData.bufferViews[A.bufferView];

            //
            let Bs = 4, isInt = 0x0, cnt = 0x0;
            if (A.componentType == 5126) { Bs = 4 };
            if (A.componentType == 5123) { Bs = 2, isInt = 0x8 };
            if (A.componentType == 5125) { Bs = 4, isInt = 0x8 };
            const is16bit = Bs == 2 ? 0x4 : 0x0;

            //
            if (A.type == "SCALAR") { Bs *= 1; cnt = 0x0; };
            if (A.type == "VEC2") { Bs *= 2; cnt = 0x1; };
            if (A.type == "VEC3") { Bs *= 3; cnt = 0x2; };
            if (A.type == "VEC4") { Bs *= 4; cnt = 0x3; };

            //
            const _bstride = A.byteStride ||                      B.byteStride || Bs;
            const _blength = A.byteLength || A?.count*_bstride || B.byteLength;

            //
            bindings.push({
                $address: buffersGPU[B.buffer].getDeviceAddress() + BigInt(A?.byteOffset||0) + BigInt(B?.byteOffset||0),
                $length: A.count || (_blength / _bstride),
                range: _blength,
                stride: _bstride,
                format: (cnt | is16bit | isInt)
            });
        });

        // 
        let textureDescIndices = new Array(rawData.images.length).fill(-1);
        let samplerDescIndices = [];
        if (rawData.samplers) {
            samplerDescIndices = rawData.samplers.map((S)=>(deviceObj.createSampler({
                pipelineLayout: this.cInfo.pipelineLayout,
                samplerInfo: {
                    magFilter: V.VK_FILTER_LINEAR,
                    minFilter: V.VK_FILTER_LINEAR,
                    addressModeU: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                    addressModeV: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                    addressModeW: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                }
            }).DSC_ID));
        } else {
            samplerDescIndices.push(deviceObj.createSampler({
                pipelineLayout: this.cInfo.pipelineLayout,
                samplerInfo: {
                    magFilter: V.VK_FILTER_LINEAR,
                    minFilter: V.VK_FILTER_LINEAR,
                    addressModeU: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                    addressModeV: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                    addressModeW: V.VK_SAMPLER_ADDRESS_MODE_REPEAT,
                }
            }).DSC_ID);
        }

        // 
        const meshes = new Array(rawData.meshes.length).fill({}); // bottom levels
        const materials = []; //
        const geometries = [];

        //
        await Promise.all(rawData.images.map(async (I, L)=>{
            textureDescIndices[L] = await this.load(I.uri, relative);
        }));

        //
        rawData.materials.map((M)=>{
            const material = {}; materials.push(material);
            const X = Math.max(M.pbrMetallicRoughness?.baseColorTexture?.index, -1);
            const P = Math.max(M.pbrMetallicRoughness?.metallicRoughnessTexture?.index, -1);
            const N = Math.max(M.normalTexture?.index, -1);
            const E = Math.max(M.emissiveTexture?.index, -1);
            material.diffuse = {
                tex: X >= 0 ? Math.max(textureDescIndices[rawData.textures[X].source], -1): -1,
                sam: X >= 0 ? Math.max(samplerDescIndices[rawData.textures[X].sampler], 0) : 0,
                col: [0.0, 0.0, 0.0, 1.0]
            }
            material.PBR = {
                tex: P >= 0 ? Math.max(textureDescIndices[rawData.textures[P].source], -1) : -1,
                sam: P >= 0 ? Math.max(samplerDescIndices[rawData.textures[P].sampler], 0) :  0,
                col: [0.0, 0.0, 0.0, 0.0]
            }
            material.normal = {
                tex: N >= 0 ? Math.max(textureDescIndices[rawData.textures[N].source], -1) : -1,
                sam: N >= 0 ? Math.max(samplerDescIndices[rawData.textures[N].sampler], 0) :  0,
                col: [0.0, 0.0, 0.5, 0.5]
            }
            material.emissive = {
                tex: E >= 0 ? Math.max(textureDescIndices[rawData.textures[E].source], -1) : -1,
                sam: E >= 0 ? Math.max(samplerDescIndices[rawData.textures[E].sampler], 0) :  0,
                col: M.emissiveFactor ? [...M.emissiveFactor, 0.0] : [0,0,0,0]
            }
        });

        //
        const materialData = new nrMaterial(materials);
        materialBuffer.map().set(materialData.buffer);
        materialBuffer.unmap();

        //
        const meshBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: nrMesh.byteLength * rawData.meshes.length }));
        const meshBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: nrMesh.byteLength * rawData.meshes.length, usage: V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT }));

        // 
        const geometryBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ 
            size: rawData.meshes.reduce((acc, M)=>{ return acc + M.primitives.length; }, 0) * nrGeometry.byteLength
        }));
        const geometryBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ 
            size: rawData.meshes.reduce((acc, M)=>{ return acc + M.primitives.length; }, 0) * nrGeometry.byteLength, 
            usage: V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT 
        }));

        //
        await Promise.all(rawData.meshes.map(async (M,K)=>{
            const mesh = { geometries: [], geometryCount: 0 };
            meshes[K] = mesh;

            //
            mesh.info = { geometryCount: mesh.geometryCount, $address: geometryBufferGPU.getDeviceAddress() + BigInt(geometries.length) * BigInt(nrGeometry.byteLength) };
            mesh.geometries = M.primitives.map((P)=>{
                const geometryId = geometries.length;
                geometries.push({
                    vertex: bindings[P.attributes["POSITION"]],
                    normal: bindings[P.attributes["NORMAL"]],
                    tangent: bindings[P.attributes["TANGENT"]],
                    texcoord: bindings[P.attributes["TEXCOORD_0"]],
                    indice: bindings[P.indices],
                    primitiveCount: (bindings[P.indices]?.$length || bindings[P.attributes["POSITION"]]?.$length || 3) / 3,
                    materialAddress: materialBufferGPU.getDeviceAddress() + BigInt(nrMaterial.byteLength * P.material)
                });

                //
                mesh.geometryCount++;
                return geometryId;
            });

            //
            const asGeometries = mesh.geometries.map((G,I)=>({
                opaque: false,
                primitiveCount: geometries[G].primitiveCount,
                geometry: {
                    indexData: geometries[G].indice?.$address,
                    indexType: geometries[G].indice?.$address ? (is16bit(geometries[G].indice.format) ? V.VK_INDEX_TYPE_UINT16 : V.VK_INDEX_TYPE_UINT32) : V.VK_INDEX_TYPE_NONE_KHR,
                    vertexFormat: V.VK_FORMAT_R32G32B32_SFLOAT, // currently, only supported FVEC3
                    vertexData: geometries[G].vertex?.$address,
                    vertexStride: geometries[G].vertex.stride,
                    maxVertex: geometries[G].vertex.$length
                }
            }));

            //
            mesh.meshDeviceAddress = meshBufferGPU.getDeviceAddress() + BigInt(mesh.meshByteOffset = nrMesh.byteLength*K);
            mesh.accelerationStructure = deviceObj.createBottomLevelAccelerationStructure({ geometries: asGeometries });
            mesh.multiDraw = new V.VkMultiDrawInfoEXT(mesh.geometries.map((IDX)=>{
                return { vertexCount: geometries[IDX].primitiveCount*3 };
            }));
        }));

        //
        const geometriesData = new nrGeometry(geometries);
        geometryBuffer.map().set(geometriesData.buffer);
        geometryBuffer.unmap();

        // TODO: optimize access
        const meshInfo = new nrMesh(meshes.map((M)=>(M.info)));
        meshBuffer.map().set(meshInfo.buffer);
        meshBuffer.unmap();

        //
        //console.log(meshes);

        // 
        const parseNode = (node, matrix)=>{
            let $node = [];

            //
            if (node.translation?.length >= 3) { matrix = $M.mat4.multiply($M.mat4.create(), $M.mat4.clone(matrix), $M.mat4.fromTranslation($M.mat4.create(), $M.vec3.fromValues(...node.translation))); };
            if (node.rotation?.length >= 4) { matrix = $M.mat4.multiply($M.mat4.create(), $M.mat4.clone(matrix), $M.mat4.fromQuat($M.mat4.create(), $M.quat.fromValues(...node.rotation))); };
            if (node.scale?.length >= 3) { matrix = $M.mat4.multiply($M.mat4.create(), $M.mat4.clone(matrix), $M.mat4.fromScaling($M.mat4.create(), $M.vec3.fromValues(...node.scale))); };
            if (node.matrix?.length >= 16) { matrix = $M.mat4.multiply($M.mat4.create(), $M.mat4.clone(matrix), $M.mat4.fromQuat($M.mat4.create(), $M.mat4.fromValues(...node.matrix))); };

            //
            if (node.children) {
                $node = [...$node, ...node.children.flatMap((idx)=>{
                    return parseNode(rawData.nodes[idx], matrix);
                })];
            } else {
                const MTX = $M.mat4.transpose($M.mat4.create(), matrix);
                const MTI = $M.mat4.transpose($M.mat4.create(), $M.mat4.invert($M.mat4.create(), matrix));
                $node = [...$node, {
                    instance: {
                        "transform:f32[12]": Array.from(MTX.subarray(0, 12)),
                        instanceCustomIndex: 0,
                        mask: 0xFF,
                        instanceShaderBindingTableRecordOffset: 0,
                        flags: 0,
                        accelerationStructureReference: meshes[node.mesh].accelerationStructure.getDeviceAddress()
                    },
                    node: {
                        "transform:f32[16]": Array.from(MTX.subarray(0, 16)),
                        "transformInverse:f32[16]": Array.from(MTI.subarray(0, 16)),
                        meshBuffer: meshes[node.mesh].meshDeviceAddress,
                        meshIndex: node.mesh
                    }
                }];
            }

            return $node;
        };

        // only single instanced data supported
        const instancedData = parseNode(rawData.nodes[rawData.scenes[0].nodes[0]], $M.mat4.fromScaling($M.mat4.create(), [
            this.cInfo.scale || 1.0,
            this.cInfo.scale || 1.0,
            this.cInfo.scale || 1.0
        ]));

        //
        const nodeData = new nrNode(instancedData.map((ID)=>(ID.node)));
        const nodeAccelerationStructure = deviceObj.createTopLevelAccelerationStructure({
            opaque: false,
            memoryAllocator: memoryAllocatorObj.handle[0],
            instanced: instancedData.map((ID)=>(ID.instance))
        });

        // 
        const nodeBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: nrNode.byteLength * nodeData.length }));
        const nodeBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: nrNode.byteLength * nodeData.length }));

        // also, `set` offset is broken!
        // TODO: optimize accesses
        nodeBuffer.map().set(nodeData.buffer);
        nodeBuffer.unmap();

        // commit mesh buffers
        B.awaitFenceAsync(deviceObj.handle[0], deviceObj.submitOnce({
            queueFamilyIndex: 0,
            queueIndex: 0,
            cmdBufFn: async (cmdBuf)=>{
                
                buffers.map((buffer, I)=>{
                    buffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, buffersGPU[I].handle[0], [{ srcOffset: 0, dstOffset: 0, size: buffer.pInfo.size }]);
                });

                meshes.map((mesh)=>{
                    mesh.accelerationStructure.cmdBuild(cmdBuf, mesh.geometries.map((G,I)=>({
                        primitiveCount: geometries[G].primitiveCount,
                        primitiveOffset: 0,
                        firstVertex: 0,
                        transformOffset: 0
                    })))
                });

                geometryBuffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, geometryBufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: rawData.meshes.reduce((acc, M)=>{ return acc + M.primitives.length; }, 0) * nrGeometry.byteLength }]);
                materialBuffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, materialBufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: materialData.byteLength }]);
                meshBuffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, meshBufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: nrMesh.byteLength * rawData.meshes.length }]);
                nodeBuffer.cmdCopyToBuffer(cmdBuf[0]||cmdBuf, nodeBufferGPU.handle[0], [{ srcOffset: 0, dstOffset: 0, size: nrNode.byteLength * nodeData.length }]);
                nodeAccelerationStructure.cmdBuild(cmdBuf, [{
                    primitiveCount: instancedData.length,
                    primitiveOffset: 0,
                    firstVertex: 0,
                    transformOffset: 0
                }]);
                
            }
        }));

        //console.log("parsed!");

        //
        return {
            nodeAccelerationStructure,
            nodeBuffer,
            nodeBufferGPU,
            instancedData,
            meshBuffer,
            meshBufferGPU,
            textureDescIndices,
            samplerDescIndices,
            materials,
            nodeData,
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
