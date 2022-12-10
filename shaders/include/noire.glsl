//
layout (set = 0, binding = 0) uniform  texture2D textures[];

layout (set = 0, binding = 0) uniform  texture2DArray FBOF[];
layout (set = 0, binding = 0) uniform utexture2DArray FBOU[];
layout (set = 0, binding = 0, rgba32f ) uniform  image2DArray SETF[];
layout (set = 0, binding = 0, rgba32ui) uniform uimage2DArray SETU[];
layout (set = 0, binding = 0, r32ui) uniform uimage2DArray SETA[];
//_DOTHERS
layout (set = 0, binding = 0, rgb10_a2 ) uniform  image2D SWAP[];

layout (set = 1, binding = 0) uniform sampler samplers[];

//
layout (set = 2, binding = 0, scalar) uniform MData { 
    mat4x4 perspective;
    mat4x4 perspectiveInverse;
    mat4x4 modelView[2];
    mat4x4 modelViewInverse[2];
    uint64_t accStruct;
    uint64_t nodeBuffer;
    uint32_t instanceCount;
    uint16_t width, height;
    uint16_t windowWidth, windowHeight;
    uint16_t framebuffers[8];
    uint16_t imageSets[3][8];
    uint32_t frameCount;
    uint16_t linearSampler;
    uint16_t nearestSampler;
    uint16_t backgroundImageView;
    uint16_t _;
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

// META include such thing as bit-depth, format (RGBA, R, RGB, etc.)
struct nrTexBinding { vec4 col; int16_t tex, sam; uvec3 meta; };

//
min16float4 readTexData(in nrTexBinding B, in vec2 texcoord) {
    return min16float4(B.tex >= 0 ? texture(sampler2D(textures[B.tex], samplers[B.sam]), texcoord.xy) : B.col);
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
    nrTexBinding transmission; // i.e. means, it should contain IOR, etc.
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

//
#define sizeof(Type) (uint64_t(Type(uint64_t(0))+1))

// framebuffers
#define _INDICES 0
#define _DERRIVE 1
#define _BARY 2
#define _TEXCOORD 3
//#define _WPOS 5

// image sets
#define _AVERAGE 0
#define _DREPROJ 1
#define _METAPBR 2
#define _DFACTOR 3
//#define _TBNDATA 4
#define _DOTHERS 4
#define _UATOMIC 5
#define _PRECISE 6
#define _DFILTER 7

//
vec4 ssW(in vec4 V4) {
    vec4 S = (V4 * perspective);
    //S.y *= -1.f;
    return S;
}

//
vec4 ss(in vec4 V4) {
    vec4 S = divW(V4 * perspective);
    //S.y *= -1.f;
    return S;
}

//
vec4 unss(in vec4 V4) {
    //V4.y *= -1.f;
    return divW(V4 * inverse(perspective));
}

//
ivec2 invertY(ivec2 coord) {
    return ivec2(coord.x, height - coord.y - 1);
    //return coord;
}

//
vec2 invertY(vec2 coord) {
    return vec2(coord.x, 1.f - coord.y);
    //return coord;
}

// TODO: Vulkan Memory Semantic Using
u16vec2 imageSetAtomicMaxU2(in int IMG_STORE, in ivec2 coord, in uvec2 XY, in int layer) {
    return unpack16(imageAtomicMax(SETA[imageSets[2][IMG_STORE]], ivec3(coord, layer), pack32(u16vec2(XY))));
}

void imageSetAtomicStoreU2(in int IMG_STORE, in ivec2 coord, in uvec2 XY, in int layer) {
    imageAtomicExchange(SETA[imageSets[2][IMG_STORE]], ivec3(coord, layer), pack32(u16vec2(XY)));
}

void imageSetAtomicStoreU(in int IMG_STORE, in ivec2 coord, in uint X, in int layer) {
    imageAtomicExchange(SETA[imageSets[2][IMG_STORE]], ivec3(coord, layer), X);
}

uint imageSetAtomicLoadU(in int IMG_STORE, in ivec2 coord, in int layer) {
    return texelFetch(FBOU[imageSets[0][IMG_STORE]], ivec3(coord.x, coord.y, layer), 0).r;
}

u16vec2 imageSetAtomicLoadU2(in int IMG_STORE, in ivec2 coord, in int layer) {
    return unpack16(texelFetch(FBOU[imageSets[0][IMG_STORE]], ivec3(coord.x, coord.y, layer), 0).r);
}

uint imageSetAtomicLoadPrevU(in int IMG_STORE, in ivec2 coord, in int layer) {
    return texelFetch(FBOU[imageSets[1][IMG_STORE]], ivec3(coord.x, coord.y, layer), 0).r;
}

u16vec2 imageSetAtomicLoadPrevU2(in int IMG_STORE, in ivec2 coord, in int layer) {
    return unpack16(texelFetch(FBOU[imageSets[1][IMG_STORE]], ivec3(coord.x, coord.y, layer), 0).r);
}

//
/*
vec4 imageSetAtomicLoadF(in int IMG_STORE, in ivec2 coord, in int layer, in int state) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    //coord = invertY(coord);
    return vec4(
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x0, coord.y, layer), 0).r,
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x1, coord.y, layer), 0).r,
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x2, coord.y, layer), 0).r,
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x3, coord.y, layer), 0).r
    );
}

//
void imageSetAtomicStoreF(in int IMG_STORE, in ivec2 coord, in vec4 RGBA, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    imageStore(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x0, coord.y, layer), vec4(RGBA.x));
    imageStore(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x1, coord.y, layer), vec4(RGBA.y));
    imageStore(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x2, coord.y, layer), vec4(RGBA.z));
    imageStore(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x3, coord.y, layer), vec4(RGBA.w));
}

//
vec4 imageSetAtomicAccumF(in int IMG_STORE, in ivec2 coord, in vec4 RGBA, in int layer) {
    return vec4(
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x0, coord.y, layer), RGBA.x).r,
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x1, coord.y, layer), RGBA.y).r,
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x2, coord.y, layer), RGBA.z).r,
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x3, coord.y, layer), RGBA.w).r
    );
}*/

//
vec4 imageSetLoadPrevLinF(in int IMG_STORE, in vec2 coord, in int layer) {
    return textureLod(sampler2DArray(FBOF[imageSets[1][IMG_STORE]], samplers[linearSampler]), vec3((coord), float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
}

//
vec4 imageSetLoadLinF(in int IMG_STORE, in vec2 coord, in int layer) {
    return textureLod(sampler2DArray(FBOF[imageSets[0][IMG_STORE]], samplers[linearSampler]), vec3((coord), float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
}

//
vec4 imageSetLoadNearestF(in uint IMG_STORE, in vec2 coord, in int layer ) {
    return textureLod(sampler2DArray(FBOF[imageSets[0][IMG_STORE]], samplers[nearestSampler]), vec3((coord), float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
}

//
vec4 imageSetLoadF(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOF[imageSets[0][IMG_STORE]], ivec3((coord), layer), 0);
}

uvec4 imageSetLoadU(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOU[imageSets[0][IMG_STORE]], ivec3((coord), layer), 0);
}

//
vec4 imageSetLoadPrevF(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOF[imageSets[1][IMG_STORE]], ivec3((coord), layer), 0);
}

uvec4 imageSetLoadPrevU(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOU[imageSets[1][IMG_STORE]], ivec3((coord), layer), 0);
}

//
vec4 framebufferLoadLinF(in int TEX_STORE, in vec2 coord, in int layer) {
    return textureLod(sampler2DArray(FBOF[framebuffers[TEX_STORE]], samplers[nearestSampler]), vec3(invertY(coord), float(layer)), 0.0);
}

//
vec4 framebufferLoadF(in int TEX_STORE, in ivec2 coord, in int layer) {
    return texelFetch(FBOF[framebuffers[TEX_STORE]], ivec3(invertY(coord), layer), 0);
}

//
uvec4 framebufferLoadU(in int TEX_STORE, in ivec2 coord, in int layer) {
    return texelFetch(FBOU[framebuffers[TEX_STORE]], ivec3(invertY(coord), layer), 0);
}

//
void imageSetStoreF(in int IMG_STORE, in ivec2 coord, in vec4 RGBA, in int layer) {
    imageStore(SETF[imageSets[2][IMG_STORE]], ivec3(coord, layer), RGBA);
}

void imageSetStoreU(in int IMG_STORE, in ivec2 coord, in uvec4 RGBA, in int layer) {
    imageStore(SETU[imageSets[2][IMG_STORE]], ivec3(coord, layer), RGBA);
}

void imageSetStoreRGBF(in int IMG_STORE, in ivec2 coord, in vec3 RGB, in int layer) {
    const vec4 C = vec4(RGB, imageLoad(SETF[imageSets[2][IMG_STORE]], ivec3(coord, layer)).a);
    imageStore(SETF[imageSets[2][IMG_STORE]], ivec3(coord, layer), C);
}

void imageSetStoreAF(in int IMG_STORE, in ivec2 coord, in float A, in int layer) {
    const vec4 C = vec4(imageLoad(SETF[imageSets[2][IMG_STORE]], ivec3(coord, layer)).rgb, A);
    imageStore(SETF[imageSets[2][IMG_STORE]], ivec3(coord, layer), C);
}

void imageSetStoreRF(in int IMG_STORE, in ivec2 coord, in float R, in int layer) {
    const vec4 C = vec4(R, imageLoad(SETF[imageSets[2][IMG_STORE]], ivec3(coord, layer)).gba);
    imageStore(SETF[imageSets[2][IMG_STORE]], ivec3(coord, layer), C);
}


