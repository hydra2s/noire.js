//
layout (set = 0, binding = 0) uniform texture2D textures[];
layout (set = 0, binding = 0, rgba8) uniform image2D images[];
layout (set = 1, binding = 0) uniform sampler samplers[];

//
layout (set = 2, binding = 0, scalar) uniform MData { 
    mat4x4 perspective;
    mat4x4 perspectiveInverse;
    mat4x4 modelView;
    mat4x4 modelViewInverse;
    uint64_t accStruct;
    uint64_t nodeBuffer;
};

layout (push_constant) uniform PData {
    uint32_t imageIndex;
};

//
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrMesh {
    uint64_t address;
    uint32_t geometryCount;
    uint32_t flags;
};

//
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrNode {
    mat3x4 transform;
    uint64_t meshBuffer;
    uint32_t meshIndex;
    uint32_t _;
};

//
/*layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrBinding {
    uint64_t address;
    uint32_t length;
    uint32_t range;
    uint32_t stride;
    uint32_t format;
};*/

//
//layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrTexBinding {
    //vec4 col; int32_t tex, sam;
//};

struct nrBinding {
    uint64_t address;
    uint32_t length;
    uint32_t range;
    uint32_t stride;
    uint32_t format;
};

//
struct nrTexBinding { vec4 col; int32_t tex, sam; };

//
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrGeometry {
    nrBinding vertex;
    nrBinding indice;
    nrBinding normal;
    nrBinding colors;
    nrBinding tangent;
    nrBinding texcoord;
    uint32_t primitiveCount;
    uint32_t _;
    uint64_t materialAddress;
};

//
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrUshort3 { u16vec3 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrUvec3 { uvec3 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nfFloat4 { vec4 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nfFloat3 { vec3 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nfFloat2 { vec2 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nfFloat { float v; };

//
layout (buffer_reference, scalar, buffer_reference_align = 1) buffer nrMaterial {
    nrTexBinding diffuse;
    nrTexBinding normal;
    nrTexBinding PBR;
    nrTexBinding emissive;
};

//
vec4 readFloatData(inout nrBinding binding, in uint index) {
    const uint cnt = binding.format & 0x3;
    const uint is16bit = binding.format & 0x4;
    const uint isInt = binding.format & 0x8;

    //
    if (binding.address > 0) {
        if (cnt == 3) { return vec4(nfFloat4(binding.address + binding.stride*index).v); };
        if (cnt == 2) { return vec4(nfFloat3(binding.address + binding.stride*index).v, 1.f); };
        if (cnt == 1) { return vec4(nfFloat2(binding.address + binding.stride*index).v, 0.f, 1.f); };
        return vec4(nfFloat(binding.address + binding.stride*index).v, 0.f, 0.f, 1.f);
    }
    return vec4(0.f.xxx, 1.f);
};

//
mat3x4 readFloatData3(inout nrBinding binding, in uvec3 index3) {
    return mat3x4(
        readFloatData(binding, index3.x),
        readFloatData(binding, index3.y),
        readFloatData(binding, index3.z)
    );
};

//
uvec3 readIndexData(inout nrBinding binding, in uint index) {
    const uint cnt = binding.format & 0x3;
    const uint is16bit = binding.format & 0x4;
    const uint isInt = binding.format & 0x8;

    //
    if (binding.address > 0) {
        return is16bit>0 ? nrUshort3(binding.address + index*6).v : nrUvec3(binding.address + index*12).v;
    }
    return (uvec3(0, 1, 2) + index*3);
};

//
struct RayTracedData {
    vec4 diffuse;
    vec4 normal;
    vec4 PBR;
    vec4 emissive;
    uvec4 indices;
    uint64_t materialAddress;
    vec2 texcoord;
    vec4 origin;
    mat3x4 objectToWorld;
    mat3x4 worldToObject;
};

//
RayTracedData rayTrace(in vec3 origin, in vec3 dir) {
    RayTracedData rayData;
    rayData.normal = vec4(0.f, 0.f, 0.5f, 0.f);
    rayData.diffuse = vec4(0.f.xxx, 1.f);

    //
    rayQueryEXT rayQuery;
    rayQueryInitializeEXT(rayQuery, accelerationStructureEXT(accStruct), gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, origin, 0.0001f, dir, 10000.f);

    //
    while(rayQueryProceedEXT(rayQuery)) {
        rayQueryConfirmIntersectionEXT(rayQuery);
    }

    //
    if (rayQueryGetIntersectionTypeEXT(rayQuery, true) == gl_RayQueryCommittedIntersectionTriangleEXT) {
        const vec2 bary_ = rayQueryGetIntersectionBarycentricsEXT(rayQuery, true);
        const vec3 bary = vec3(1.f - bary_.x - bary_.y, bary_.xy);
        const uvec4 sys = uvec4(rayQueryGetIntersectionInstanceIdEXT(rayQuery, true), rayQueryGetIntersectionGeometryIndexEXT(rayQuery, true), rayQueryGetIntersectionPrimitiveIndexEXT(rayQuery, true), 0u);

        //
        nrNode nodeData = nrNode(nodeBuffer) + sys.x;
        nrMesh meshData = nrMesh(nodeData.meshBuffer);
        nrGeometry geometryData = nrGeometry(meshData.address) + sys.y;
        uvec3 indices = readIndexData(geometryData.indice, sys.z);
        vec4 texcoord = readFloatData3(geometryData.texcoord, indices) * bary;

        //
        nrMaterial materialData = nrMaterial(geometryData.materialAddress);

        //
        rayData.objectToWorld = transpose(rayQueryGetIntersectionObjectToWorldEXT(rayQuery, true));
        rayData.worldToObject = transpose(rayQueryGetIntersectionWorldToObjectEXT(rayQuery, true));
        rayData.origin = vec4(vec4(rayQueryGetIntersectionObjectRayOriginEXT(rayQuery, true), 1.f) * rayData.objectToWorld, rayQueryGetIntersectionTEXT(rayQuery, true));
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        //
        rayData.emissive = materialData.emissive.tex >= 0 ? texture(sampler2D(textures[materialData.emissive.tex], samplers[materialData.emissive.sam]), texcoord.xy) : materialData.emissive.col;
        rayData.diffuse = materialData.diffuse.tex >= 0 ? texture(sampler2D(textures[materialData.diffuse.tex], samplers[materialData.diffuse.sam]), texcoord.xy) : materialData.diffuse.col;
        rayData.normal = materialData.normal.tex >= 0 ? texture(sampler2D(textures[materialData.normal.tex], samplers[materialData.normal.sam]), texcoord.xy) : materialData.normal.col;
        rayData.PBR = materialData.PBR.tex >= 0 ? texture(sampler2D(textures[materialData.PBR.tex], samplers[materialData.PBR.sam]), texcoord.xy) : materialData.PBR.col;
    }

    return rayData;
}