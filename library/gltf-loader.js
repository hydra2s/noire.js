import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
const nrBinding = new Proxy(C.CStructView, new C.CStruct("nrBinding", {
    $address: "u64",
    length: "u32",
    range: "u32",
    stride: "u32",
    format: "u32"
}));

// bottom level of AS
const nrMesh = new Proxy(C.CStructView, new C.CStruct("nrMesh", {
    $address: "64",
    geometryCount: "u32",
    flags: "u32"
}));

//
const nrGeometry = new Proxy(C.CStructView, new C.CStruct("nrGeometry", {
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
const nrInstance = new Proxy(C.CStructView, new C.CStruct("nrInstance", {
    transform: "f32[12]",
    accStruct: "u64",
    
}));

//
const nrMaterial = new Proxy(C.CStructView, new C.CStruct("nrMaterial", {
     
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
        const fileData = await fs.promises.readFile(file);
        const ext = getFileExtension(file);
        let parsedData = null;

        switch(ext) {
            case "gltf":
            parsedData = this.parse(fileData);
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
        const textureDescIndices = [];
        const samplerDescIndices = [];

        // 
        const meshes = []; // bottom levels
        const nodes = []; // top levels
        const materials = []; //
        const geometries = [];

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
                    material: materialBufferGPU.getDeviceAddress() + nrMaterial.byteLength * rawData.materials.length
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
export default GltfLoaderObj;
