//
layout (set = 0, binding = 0) uniform texture2D textures[];
layout (set = 0, binding = 0) uniform utexture2D texturesU[];
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
    uint32_t instanceCount;
    uint16_t width, height;
    uint16_t windowWidth, windowHeight;
    uint16_t _[2];
    uint16_t framebuffers[8];
    uint32_t frameCount;
    uint32_t linearSampler;
};

layout (push_constant) uniform PConst {
    uint32_t imageIndex;
    uint32_t instanceId;
};

//
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrMesh {
    uint64_t address;
    uint32_t geometryCount;
    uint32_t flags;
};

//
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrNode {
    mat4x4 transform;
    mat4x4 transformInverse;
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
struct nrTexBinding { vec4 col; int16_t tex, sam; };

//
f16vec4 readTexData(in nrTexBinding B, in vec2 texcoord) {
    return f16vec4(B.tex >= 0 ? texture(sampler2D(textures[B.tex], samplers[B.sam]), texcoord.xy) : B.col);
}

//
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrGeometry {
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
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrUshort { uint16_t v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrUvec { uint v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrUshort3 { u16vec3 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrUvec3 { uvec3 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nfFloat4 { vec4 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nfFloat3 { vec3 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nfFloat2 { vec2 v; };
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nfFloat { float v; };

//
layout (buffer_reference, scalar, buffer_reference_align = 1) readonly buffer nrMaterial {
    nrTexBinding diffuse;
    nrTexBinding normal;
    nrTexBinding PBR;
    nrTexBinding emissive;
};

//
vec4 readFloatData(in nrBinding binding, in uint index) {
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
mat3x4 readFloatData3(in nrBinding binding, in uvec3 index3) {
    return mat3x4(
        readFloatData(binding, index3.x),
        readFloatData(binding, index3.y),
        readFloatData(binding, index3.z)
    );
};

//
uvec3 readIndexData3(in nrBinding binding, in uint index) {
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
uint readIndexData(in nrBinding binding, in uint index) {
    const uint cnt = binding.format & 0x3;
    const uint is16bit = binding.format & 0x4;
    const uint isInt = binding.format & 0x8;

    //
    if (binding.address > 0) {
        return is16bit>0 ? nrUshort(binding.address + index*2).v : nrUvec(binding.address + index*4).v;
    }
    return index;
};

