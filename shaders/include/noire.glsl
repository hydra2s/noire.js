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
    uint16_t loadSets[6];
    uint16_t storeSets[6];
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

/*vec4 tex2DBiLinear( in uint F, in vec2 texCoord_f, in int layer )
{
    const vec2 imageSize = vec2(imageSize(SETF[loadSets[F]]).xy);
    const ivec3 texCoord_i = ivec3(texCoord_f * imageSize.xy - 0.5f, layer);
    const vec4 p0q0 = imageLoad(SETF[loadSets[F]], texCoord_i);
    const vec4 p1q0 = imageLoad(SETF[loadSets[F]], texCoord_i + ivec3(1, 0, 0));
    const vec4 p0q1 = imageLoad(SETF[loadSets[F]], texCoord_i + ivec3(0, 1, 0));
    const vec4 p1q1 = imageLoad(SETF[loadSets[F]], texCoord_i + ivec3(1, 1, 0));
    const float a = fract( texCoord_f.x * imageSize.x - 0.5f ); // Get Interpolation factor for X direction.
    const vec4 pInterp_q0 = mix( p0q0, p1q0, a ); // Interpolates top row in X direction.
    const vec4 pInterp_q1 = mix( p0q1, p1q1, a ); // Interpolates bottom row in X direction.
    const float b = fract( texCoord_f.y * imageSize.y - 0.5f );// Get Interpolation factor for Y direction.
    return mix( pInterp_q0, pInterp_q1, b ); // Interpolate in Y direction.
};*/

//
vec4 tex2DBiLinear(in int IMG_STORE, in vec2 coord, in int layer) {
    //return imageLoad(SETF[loadSets[IMG_STORE]], ivec3(coord, layer));
    return textureLod(sampler2DArray(FBOF[loadSets[IMG_STORE]], samplers[linearSampler]), vec3(coord, float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
}

vec4 tex2DBNearest( in uint F, in vec2 texCoord_f, in int layer ) {
    const ivec3 texCoord_i = ivec3(texCoord_f * imageSize(SETF[loadSets[F]]).xy, layer);
    return imageLoad(SETF[loadSets[F]], texCoord_i);
}

//float linearize_depth(float d, float zNear,float zFar)
//{
    //return zNear * zFar / (zFar + d * (zNear - zFar));
    //return 1.0f / (d * zFar - zNear);

    //float z_n = 2.0 * d - 1.0;
    //return 2.0 * zNear * zFar / (zFar + zNear - z_n * (zFar - zNear));
    //return d;
//}

#define sizeof(Type) (uint64_t(Type(uint64_t(0))+1))

// framebuffers
#define _POSITION 2
#define _NORMAL 3
#define _PBR 4

// image sets
#define _DIFFUSE 0
#define _METAPBR 1
#define _AVERAGE 2
#define _REFLECT 3
#define _RINDICE 4

//
vec4 imageLoadAtomic(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[loadSets[IMG_STORE]], ivec3(coord, layer));
    return vec4(
        texelFetch(FBOF[loadSets[IMG_STORE]], ivec3((coord.x<<2)|0x0, coord.y, layer), 0).r,
        texelFetch(FBOF[loadSets[IMG_STORE]], ivec3((coord.x<<2)|0x1, coord.y, layer), 0).r,
        texelFetch(FBOF[loadSets[IMG_STORE]], ivec3((coord.x<<2)|0x2, coord.y, layer), 0).r,
        texelFetch(FBOF[loadSets[IMG_STORE]], ivec3((coord.x<<2)|0x3, coord.y, layer), 0).r
    );
}

//
vec4 imageAccumAtomic(in int IMG_STORE, in ivec2 coord, in vec4 RGBA, in int layer) {
    return vec4(
        imageAtomicAdd(SETA[storeSets[IMG_STORE]], ivec3((coord.x<<2)|0x0, coord.y, layer), RGBA.x).r,
        imageAtomicAdd(SETA[storeSets[IMG_STORE]], ivec3((coord.x<<2)|0x1, coord.y, layer), RGBA.y).r,
        imageAtomicAdd(SETA[storeSets[IMG_STORE]], ivec3((coord.x<<2)|0x2, coord.y, layer), RGBA.z).r,
        imageAtomicAdd(SETA[storeSets[IMG_STORE]], ivec3((coord.x<<2)|0x3, coord.y, layer), RGBA.w).r
    );
}

//
vec4 imageLoad(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[loadSets[IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOF[loadSets[IMG_STORE]], ivec3(coord, layer), 0);
}

uvec4 imageLoadU(in int IMG_STORE, in ivec2 coord, in int layer) {
    //return imageLoad(SETF[loadSets[IMG_STORE]], ivec3(coord, layer));
    return texelFetch(FBOU[loadSets[IMG_STORE]], ivec3(coord, layer), 0);
}

//
vec4 textureLod(in int TEX_STORE, in vec2 coord, in int layer) {
    //return textureLod(sampler2DArray(FBOF[framebuffers[TEX_STORE]], samplers[linearSampler]), vec3(coord, float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
    return textureLod(sampler2DArray(FBOF[framebuffers[TEX_STORE]], samplers[nearestSampler]), vec3(coord, float(layer) /*/ textureSize(FBOF[framebuffers[TEX_STORE]], 0).z*/), 0.0);
}

//
vec4 texelFetch(in int TEX_STORE, in ivec2 coord, in int layer) {
    return texelFetch(FBOF[framebuffers[TEX_STORE]], ivec3(coord, layer), 0);
}

//
void imageStore(in int IMG_STORE, in ivec2 coord, in vec4 RGBA, in int layer) {
    imageStore(SETF[storeSets[IMG_STORE]], ivec3(coord, layer), RGBA);
}

void imageStoreU(in int IMG_STORE, in ivec2 coord, in uvec4 RGBA, in int layer) {
    imageStore(SETU[storeSets[IMG_STORE]], ivec3(coord, layer), RGBA);
}

void imageStoreRGB(in int IMG_STORE, in ivec2 coord, in vec3 RGB, in int layer) {
    const vec4 C = vec4(RGB, imageLoad(SETF[storeSets[IMG_STORE]], ivec3(coord, layer)).a);
    imageStore(SETF[storeSets[IMG_STORE]], ivec3(coord, layer), C);
}

void imageStoreA(in int IMG_STORE, in ivec2 coord, in float A, in int layer) {
    const vec4 C = vec4(imageLoad(SETF[storeSets[IMG_STORE]], ivec3(coord, layer)).rgb, A);
    imageStore(SETF[storeSets[IMG_STORE]], ivec3(coord, layer), C);
}

//
#ifdef _ENABLE_FXD


//
float FFX_DNSR_Reflections_GetRandom(int2 pixel_coordinate) { return gold_noise(float2(pixel_coordinate), 0.0 + float(frameCount)) * 0.5f + 0.5f; }

//
float FFX_DNSR_Shadows_GetDepthSimilaritySigma() { return 0.01f; }
float FFX_DNSR_Reflections_LoadDepth       (int2 pixel_coordinate)  { return divW(texelFetch(_POSITION, pixel_coordinate, 0)).z; }
float FFX_DNSR_Reflections_LoadDepthHistory(int2 pixel_coordinate)  { return divW(texelFetch(_POSITION, pixel_coordinate, 1)).z; }
float FFX_DNSR_Reflections_SampleDepthHistory(float2 uv)            { return divW(textureLod(_POSITION, uv, 1)).z; }
float FFX_DNSR_Reflections_GetLinearDepth(float2 uv, float history) {  
    //return length(divW(vec4(uv*2.f-1.f, history, 1.f) * perspectiveInverse).xyz);
    return divW(vec4(uv*2.f-1.f, history, 1.f) * perspectiveInverse).z;
}

//
min16float3 FFX_DNSR_Reflections_LoadRadiance           (int2 pixel_coordinate) { return imageLoad(_DIFFUSE, pixel_coordinate, 0).xyz; }
min16float3 FFX_DNSR_Reflections_LoadRadianceHistory    (int2 pixel_coordinate) { return imageLoad(_DIFFUSE, pixel_coordinate, 1).xyz; }
min16float3 FFX_DNSR_Reflections_LoadRadianceReprojected(int2 pixel_coordinate) { return imageLoad(_DIFFUSE, pixel_coordinate, 2).xyz; }
min16float3 FFX_DNSR_Reflections_SampleRadianceHistory  (float2 uv)             { return tex2DBiLinear(_DIFFUSE, uv, 1).xyz;;  }

//
void  FFX_DNSR_Reflections_StoreRadianceReprojected   (int2 pixel_coordinate, min16float3 value)                            { imageStoreRGB(_DIFFUSE, pixel_coordinate, value, 2); }
void  FFX_DNSR_Reflections_StoreTemporalAccumulation  (int2 pixel_coordinate, min16float3 new_signal, min16float new_variance) { imageStore(_DIFFUSE, pixel_coordinate, vec4(new_signal, new_variance), 0); }
void  FFX_DNSR_Reflections_StorePrefilteredReflections(int2 pixel_coordinate, min16float3   radiance, min16float     variance) { imageStore(_DIFFUSE, pixel_coordinate, vec4(radiance  ,     variance), 0); };

//
min16float3 FFX_DNSR_Reflections_SampleAverageRadiance        (float2 uv) { return (tex2DBiLinear(_AVERAGE, uv, 0)).xyz; }
min16float3 FFX_DNSR_Reflections_SamplePreviousAverageRadiance(float2 uv) { return (tex2DBiLinear(_AVERAGE, uv, 1)).xyz; }
void  FFX_DNSR_Reflections_StoreAverageRadiance         (int2 pixel_coordinate, min16float3 value) { imageStoreRGB(_AVERAGE, pixel_coordinate, value, 0); };

//
min16float FFX_DNSR_Reflections_LoadVariance (int2 pixel_coordinate) {       return imageLoad    (_DIFFUSE, pixel_coordinate, 0).w; }
void FFX_DNSR_Reflections_StoreVariance(int2 pixel_coordinate, min16float  value) { imageStoreA  (_DIFFUSE, pixel_coordinate, value, 0); }
min16float FFX_DNSR_Reflections_SampleVarianceHistory(float2 uv)           { return tex2DBiLinear(_DIFFUSE, uv, 1).w; }

//
min16float3 FFX_DNSR_Reflections_LoadWorldSpaceNormal(int2 pixel_coordinate)        { return normalize((modelView[0] * vec4(texelFetch(_NORMAL, pixel_coordinate, 0).rgb, 0)).xyz); }
min16float3 FFX_DNSR_Reflections_LoadWorldSpaceNormalHistory(int2 pixel_coordinate) { return normalize((modelView[1] * vec4(texelFetch(_NORMAL, pixel_coordinate, 1).rgb, 0)).xyz); }
min16float3 FFX_DNSR_Reflections_SampleWorldSpaceNormalHistory(float2 uv)           { return normalize((modelView[1] * vec4(textureLod(_NORMAL, uv, 1).rgb, 0)).xyz); }

// 
min16float FFX_DNSR_Reflections_LoadRoughness(int2 pixel_coordinate)        { return imageLoad(_METAPBR, pixel_coordinate, 0).r; }
min16float FFX_DNSR_Reflections_LoadRoughnessHistory(int2 pixel_coordinate) { return imageLoad(_METAPBR, pixel_coordinate, 1).r; }
min16float FFX_DNSR_Reflections_SampleRoughnessHistory(float2 uv)           { return tex2DBiLinear(_METAPBR, uv, 1).r; }

// as from previous frame to current, from previous pixel coordinate
// if your pixel coordinate is current, needs to transform as previous
float2 FFX_DNSR_Reflections_LoadMotionVector(int2 pixel_coordinate) { return imageLoad(_METAPBR, pixel_coordinate, 0).yz; }

// 
min16float FFX_DNSR_Reflections_LoadRayLength(int2 pixel_coordinate) { return imageLoad(_METAPBR, pixel_coordinate, 1).w; }

//
min16float FFX_DNSR_Reflections_SampleNumSamplesHistory(float2 uv)                  { return tex2DBiLinear(_DIFFUSE, uv, 2).w; }
min16float FFX_DNSR_Reflections_LoadNumSamples (int2 pixel_coordinate)              { return imageLoad    (_DIFFUSE, pixel_coordinate, 2).w; }
void FFX_DNSR_Reflections_StoreNumSamples(int2 pixel_coordinate, min16float  value) {        imageStoreA  (_DIFFUSE, pixel_coordinate, value, 2); }

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
//bool FFX_DNSR_Reflections_IsMirrorReflection(float roughness) { return roughness >= 0.0001f && roughness  < 0.01f; };
//bool FFX_DNSR_Reflections_IsGlossyReflection(float roughness) { return roughness >= 0.0001f && roughness >= 0.01f; };
#endif
//any(greaterThan(texelFetch(FBOF[framebuffers[1]], ivec3(dispatchThreadId, 0), 0).xyz, 0.0001f.xxx))
