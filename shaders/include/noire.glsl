//
layout (set = 0, binding = 0) uniform  texture2D textures[];

layout (set = 0, binding = 0) uniform  texture2DArray FBOF[];
layout (set = 0, binding = 0) uniform utexture2DArray FBOU[];
layout (set = 0, binding = 0, rgba16f ) uniform  image2DArray SETF[];
layout (set = 0, binding = 0, rgba32ui) uniform uimage2DArray SETU[];
layout (set = 0, binding = 0, r32f) uniform image2DArray SETA[];

layout (set = 0, binding = 0, rgba8 ) uniform  image2D SWAP[];

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
    uint16_t framebuffers[6];
    uint16_t imageSets[3][6];
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

//
#define sizeof(Type) (uint64_t(Type(uint64_t(0))+1))

// framebuffers
#define _INDICES 0
#define _DERRIVE 1
#define _BARY 2
#define _POSITION 3
#define _TEXCOORD 4

// image sets
#define _AVERAGE 0
#define _FATOMIC 1
#define _METAPBR 2
#define _DIFFUSE 3
#define _TBNDATA 4
#define _REFLECT 5

//
vec4 imageSetAtomicLoadF(in int IMG_STORE, in ivec2 coord, in int layer, in int state) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return vec4(
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x0, coord.y, layer), 0).r,
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x1, coord.y, layer), 0).r,
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x2, coord.y, layer), 0).r,
        texelFetch(FBOF[imageSets[state][IMG_STORE]], ivec3((coord.x<<2)|0x3, coord.y, layer), 0).r
    );
}

//
vec4 imageSetAtomicAccumF(in int IMG_STORE, in ivec2 coord, in vec4 RGBA, in int layer) {
    return vec4(
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x0, coord.y, layer), RGBA.x).r,
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x1, coord.y, layer), RGBA.y).r,
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x2, coord.y, layer), RGBA.z).r,
        imageAtomicAdd(SETA[imageSets[2][IMG_STORE]], ivec3((coord.x<<2)|0x3, coord.y, layer), RGBA.w).r
    );
}

//
vec4 imageSetLoadPrevLinF(in int IMG_STORE, in vec2 coord, in int layer) {
    return textureLod(sampler2DArray(FBOF[imageSets[0][IMG_STORE]], samplers[linearSampler]), vec3(coord, float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
}

//
vec4 imageSetLoadLinF(in int IMG_STORE, in vec2 coord, in int layer) {
    return textureLod(sampler2DArray(FBOF[imageSets[0][IMG_STORE]], samplers[linearSampler]), vec3(coord, float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
}

//
vec4 imageSetLoadNearestF( in uint F, in vec2 texCoord_f, in int layer ) {
    const ivec3 texCoord_i = ivec3(texCoord_f * imageSize(SETF[imageSets[0][F]]).xy, layer);
    return imageLoad(SETF[imageSets[0][F]], texCoord_i);
}

//
vec4 imageSetLoadF(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOF[imageSets[0][IMG_STORE]], ivec3(coord, layer), 0);
}

uvec4 imageSetLoadU(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOU[imageSets[0][IMG_STORE]], ivec3(coord, layer), 0);
}

//
vec4 imageSetLoadPrevF(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOF[imageSets[1][IMG_STORE]], ivec3(coord, layer), 0);
}

uvec4 imageSetLoadPrevU(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[imageSets[0][IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOU[imageSets[1][IMG_STORE]], ivec3(coord, layer), 0);
}

//
vec4 framebufferLoadLinF(in int TEX_STORE, in vec2 coord, in int layer) {
    return textureLod(sampler2DArray(FBOF[framebuffers[TEX_STORE]], samplers[nearestSampler]), vec3(coord, float(layer)), 0.0);
}

//
vec4 framebufferLoadF(in int TEX_STORE, in ivec2 coord, in int layer) {
    return texelFetch(FBOF[framebuffers[TEX_STORE]], ivec3(coord, layer), 0);
}

//
uvec4 framebufferLoadU(in int TEX_STORE, in ivec2 coord, in int layer) {
    return texelFetch(FBOU[framebuffers[TEX_STORE]], ivec3(coord, layer), 0);
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

//
#ifdef _ENABLE_FXD


//
float FFX_DNSR_Reflections_GetRandom(int2 pixel_coordinate) { return gold_noise(float2(pixel_coordinate), 0.0 + float(frameCount)) * 0.5f + 0.5f; }

//
float FFX_DNSR_Shadows_GetDepthSimilaritySigma() { return 0.01f; }
float FFX_DNSR_Reflections_LoadDepth       (int2 pixel_coordinate)  { return divW(framebufferLoadF(_POSITION, pixel_coordinate, 0)).z; }
float FFX_DNSR_Reflections_LoadDepthHistory(int2 pixel_coordinate)  { return divW(framebufferLoadF(_POSITION, pixel_coordinate, 1)).z; }
float FFX_DNSR_Reflections_SampleDepthHistory(float2 uv)            { return divW(framebufferLoadLinF(_POSITION, uv, 1)).z; }
float FFX_DNSR_Reflections_GetLinearDepth(float2 uv, float history) {  
    //return length(divW(vec4(uv*2.f-1.f, history, 1.f) * perspectiveInverse).xyz);
    return divW(vec4(uv*2.f-1.f, history, 1.f) * perspectiveInverse).z;
}

//
min16float3 FFX_DNSR_Reflections_LoadRadiance           (int2 pixel_coordinate) { return imageSetLoadF(_DIFFUSE, pixel_coordinate, 0).xyz; }
min16float3 FFX_DNSR_Reflections_LoadRadianceHistory    (int2 pixel_coordinate) { return imageSetLoadPrevF(_DIFFUSE, pixel_coordinate, 0).xyz; }
min16float3 FFX_DNSR_Reflections_LoadRadianceReprojected(int2 pixel_coordinate) { return imageSetLoadF(_DIFFUSE, pixel_coordinate, 1).xyz; }
min16float3 FFX_DNSR_Reflections_SampleRadianceHistory  (float2 uv)             { return imageSetLoadPrevLinF(_DIFFUSE, uv, 0).xyz;  }

//
void FFX_DNSR_Reflections_StoreRadianceReprojected   (int2 pixel_coordinate, min16float3 value)                               { imageSetStoreRGBF(_DIFFUSE, pixel_coordinate, value, 1); };
void FFX_DNSR_Reflections_StoreTemporalAccumulation  (int2 pixel_coordinate, min16float3 new_signal, min16float new_variance) { imageSetStoreF  (_DIFFUSE, pixel_coordinate, vec4(new_signal, new_variance), 0); };
void FFX_DNSR_Reflections_StorePrefilteredReflections(int2 pixel_coordinate, min16float3   radiance, min16float     variance) { imageSetStoreF  (_DIFFUSE, pixel_coordinate, vec4(  radiance,     variance), 0); };

//
min16float3 FFX_DNSR_Reflections_SampleAverageRadiance(float2 uv) { return (imageSetLoadLinF(_AVERAGE, uv, 0)).xyz; }
void  FFX_DNSR_Reflections_StoreAverageRadiance(int2 pixel_coordinate, min16float3 value) { imageSetStoreRGBF(_AVERAGE, pixel_coordinate, value, 0); };

//
min16float FFX_DNSR_Reflections_LoadVariance (int2 pixel_coordinate) {       return imageSetLoadF  (_DIFFUSE, pixel_coordinate, 0).a; }
void FFX_DNSR_Reflections_StoreVariance(int2 pixel_coordinate, min16float  value) { imageSetStoreAF(_DIFFUSE, pixel_coordinate, value, 0); }
min16float FFX_DNSR_Reflections_SampleVarianceHistory(float2 uv)           { return imageSetLoadPrevLinF(_DIFFUSE, uv, 0).a; }

//
min16float3 FFX_DNSR_Reflections_LoadWorldSpaceNormal(int2 pixel_coordinate)        { return normalize((modelView[0] * vec4(imageSetLoadF       (_TBNDATA, pixel_coordinate, 0).rgb, 0)).xyz); }
min16float3 FFX_DNSR_Reflections_LoadWorldSpaceNormalHistory(int2 pixel_coordinate) { return normalize((modelView[1] * vec4(imageSetLoadPrevF   (_TBNDATA, pixel_coordinate, 0).rgb, 0)).xyz); }
min16float3 FFX_DNSR_Reflections_SampleWorldSpaceNormalHistory(float2 uv)           { return normalize((modelView[1] * vec4(imageSetLoadPrevLinF(_TBNDATA, uv, 0).rgb, 0)).xyz); }

// 
min16float FFX_DNSR_Reflections_LoadRoughness(int2 pixel_coordinate)        { return imageSetLoadF   (_METAPBR, pixel_coordinate, 0).g; }
min16float FFX_DNSR_Reflections_LoadRoughnessHistory(int2 pixel_coordinate) { return imageSetLoadPrevF(_METAPBR, pixel_coordinate, 0).g; }
min16float FFX_DNSR_Reflections_SampleRoughnessHistory(float2 uv)           { return imageSetLoadPrevLinF(_METAPBR, uv, 0).g; }

//
min16float FFX_DNSR_Reflections_LoadRayLength (int2 pixel_coordinate)               { return imageSetLoadF   (_METAPBR, pixel_coordinate, 0).w; }

//
min16float FFX_DNSR_Reflections_LoadNumSamples(int2 pixel_coordinate)               { return imageSetLoadF       (_METAPBR, pixel_coordinate, 0).r; }
min16float FFX_DNSR_Reflections_SampleNumSamplesHistory(float2 uv)                  { return imageSetLoadPrevLinF(_METAPBR, uv, 0).r; }
void FFX_DNSR_Reflections_StoreNumSamples(int2 pixel_coordinate, min16float  value) {        imageSetStoreRF     (_METAPBR, pixel_coordinate, value, 0); }

// as from previous frame to current, from previous pixel coordinate
// if your pixel coordinate is current, needs to transform as previous
float2 FFX_DNSR_Reflections_LoadMotionVector(int2 pixel_coordinate) { return vec2(0.f.xx); }

//
void FFX_DNSR_Reflections_LoadNeighborhood(int2 pixel_coordinate, out min16float3 radiance, out min16float variance, out min16float3 normal, out float depth, int2 screen_size) {
    depth = FFX_DNSR_Reflections_LoadDepth(pixel_coordinate);
    normal = FFX_DNSR_Reflections_LoadWorldSpaceNormal(pixel_coordinate);
    radiance = FFX_DNSR_Reflections_LoadRadiance(pixel_coordinate);
    variance = FFX_DNSR_Reflections_LoadVariance(pixel_coordinate);
}

//
vec3 ndc(in vec3 v3) {
    v3.y *= -1.f;
    v3.xy = v3.xy * 0.5f + 0.5f;
    //v3.z = v3.z * 0.5f + 0.5f;
    return v3;
}

//
vec3 undc(in vec3 v3) {
    v3.xy = v3.xy * 2.f - 1.f;
    v3.y *= -1.f;
    //v3.z = v3.z * 2.f - 1.f;
    return v3;
}

//
min16float3 FFX_DNSR_Reflections_ScreenSpaceToViewSpace(in min16float3 v3) {
    return divW(vec4(undc(v3), 1.f) * perspectiveInverse).xyz;
}

//
min16float3 FFX_DNSR_Reflections_ViewSpaceToWorldSpace(in min16float4 v3) {
    return (vec4(v3.xyz, 1.f) * modelViewInverse[0]).xyz;
}

//
min16float3 FFX_DNSR_Reflections_WorldSpaceToScreenSpacePrevious(in min16float3 v3) {
    return ndc(divW((vec4(v3, 1.f)*modelView[1]) * perspective).xyz);
}

//
bool FFX_DNSR_Reflections_IsMirrorReflection(float roughness) { return false; };
bool FFX_DNSR_Reflections_IsGlossyReflection(float roughness) { return roughness >= 0.0001f; };
#endif

