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
