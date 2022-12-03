//
layout (set = 0, binding = 0) uniform  texture2D textures[];

layout (set = 0, binding = 0) uniform  texture2DArray FBOF[];
layout (set = 0, binding = 0) uniform utexture2DArray FBOU[];
layout (set = 0, binding = 0, rgba16f ) uniform  image2DArray SETF[];
layout (set = 0, binding = 0, rgba32ui) uniform uimage2DArray SETU[];

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
    uint16_t imageSets[4];
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

vec4 tex2DBiLinear( in uint F, in vec2 texCoord_f, in int layer )
{
    const ivec3 texCoord_i = ivec3(texCoord_f * vec2(width, height), layer);
    const vec4 p0q0 = imageLoad(SETF[imageSets[F]], texCoord_i);
    const vec4 p1q0 = imageLoad(SETF[imageSets[F]], texCoord_i + ivec3(1, 0, 0));
    const vec4 p0q1 = imageLoad(SETF[imageSets[F]], texCoord_i + ivec3(0, 1, 0));
    const vec4 p1q1 = imageLoad(SETF[imageSets[F]], texCoord_i + ivec3(1, 1, 0));
    const float a = fract( texCoord_f.x * width - 0.5f ); // Get Interpolation factor for X direction.
    const vec4 pInterp_q0 = mix( p0q0, p1q0, a ); // Interpolates top row in X direction.
    const vec4 pInterp_q1 = mix( p0q1, p1q1, a ); // Interpolates bottom row in X direction.
    const float b = fract( texCoord_f.y * height - 0.5f );// Get Interpolation factor for Y direction.
    return mix( pInterp_q0, pInterp_q1, b ); // Interpolate in Y direction.
};

vec4 tex2DBiLinear( in uint F, in vec2 texCoord_f) 
{
    return tex2DBiLinear(F, texCoord_f, 0);
}


/*
//
float FFX_DNSR_Reflections_GetRandom(int2 pixel_coordinate) { return gold_noise(float2(pixel_coordinate), 0); }

//
float FFX_DNSR_Shadows_GetDepthSimilaritySigma() { return 1.f; }
float FFX_DNSR_Reflections_LoadDepth       (int2 pixel_coordinate) { return divW(FBOF[U.framebuffers[2]][int3(pixel_coordinate, 0)]).z; }
float FFX_DNSR_Reflections_LoadDepthHistory(int2 pixel_coordinate) { return divW(FBOF[U.framebuffers[2]][int3(pixel_coordinate, 1)]).z; }
float FFX_DNSR_Reflections_SampleDepthHistory(float2 uv)           { return divW(FBOF[U.framebuffers[2]].SampleLevel(SAM[U.linearSampler], float3(uv, 1.f), 0)).z; }

// 
float FFX_DNSR_Reflections_GetLinearDepth(float2 uv, float history) { return divW(FBOF[U.framebuffers[2]].SampleLevel(SAM[U.linearSampler], float3(uv, 0.f), 0)).z; };

//
half3 FFX_DNSR_Reflections_LoadRadiance           (int2 pixel_coordinate) { float4 _samp = SETF[U.imageSets[0]][int3(pixel_coordinate, 0)]; return _samp.xyz; }
half3 FFX_DNSR_Reflections_LoadRadianceHistory    (int2 pixel_coordinate) { float4 _samp = SETF[U.imageSets[0]][int3(pixel_coordinate, 1)]; return _samp.xyz; }
half3 FFX_DNSR_Reflections_LoadRadianceReprojected(int2 pixel_coordinate) { float4 _samp = SETF[U.imageSets[0]][int3(pixel_coordinate, 2)]; return _samp.xyz; }
half3 FFX_DNSR_Reflections_SampleRadianceHistory  (float2 uv) { return tex2DBiLinear(0, uv, 1).xyz;  }
void  FFX_DNSR_Reflections_StoreRadianceReprojected   (int2 pixel_coordinate, half3 value)                         { SETF[U.imageSets[0]][int3(pixel_coordinate, 2)].xyz = value; }
void  FFX_DNSR_Reflections_StoreTemporalAccumulation  (int2 pixel_coordinate, half3 new_signal, half new_variance) { SETF[U.imageSets[0]][int3(pixel_coordinate, 0)] = float4(new_signal, new_variance); };
void  FFX_DNSR_Reflections_StorePrefilteredReflections(int2 pixel_coordinate, half3   radiance, half     variance) { SETF[U.imageSets[0]][int3(pixel_coordinate, 2)] = float4(radiance  ,     variance); };

//
half3 FFX_DNSR_Reflections_SampleAverageRadiance        (float2 uv) { return (tex2DBNearest(1, uv / 1.f, 0)).xyz; }
half3 FFX_DNSR_Reflections_SamplePreviousAverageRadiance(float2 uv) { return (tex2DBNearest(1, uv / 1.f, 1)).xyz; }
void  FFX_DNSR_Reflections_StoreAverageRadiance         (int2 pixel_coordinate, half3 value) { SETF[U.imageSets[1]][int3(pixel_coordinate, 0)].xyz = value; }; // unsupported

//
half FFX_DNSR_Reflections_LoadVariance (int2 pixel_coordinate) {                     return SETF[U.imageSets[0]][int3(pixel_coordinate, 0)].w; }
void FFX_DNSR_Reflections_StoreVariance(int2 pixel_coordinate, half  value) { float4 _col = SETF[U.imageSets[0]][int3(pixel_coordinate, 0)].w = value; }
half FFX_DNSR_Reflections_SampleVarianceHistory(float2 uv) { return tex2DBiLinear(0, uv, 1).w; }

//
half3 FFX_DNSR_Reflections_LoadWorldSpaceNormal(int2 pixel_coordinate)        { return normalize(mul(U.modelView[0], float4(FBOF[U.framebuffers[3]][int3(pixel_coordinate, 0)].xyz, 0.0)).xyz); }
half3 FFX_DNSR_Reflections_LoadWorldSpaceNormalHistory(int2 pixel_coordinate) { return normalize(mul(U.modelView[0], float4(FBOF[U.framebuffers[3]][int3(pixel_coordinate, 1)].xyz, 0.0)).xyz); }
half3 FFX_DNSR_Reflections_SampleWorldSpaceNormalHistory(float2 uv)           { return normalize(mul(U.modelView[0], float4(FBOF[U.framebuffers[3]].SampleLevel(SAM[U.linearSampler], float3(uv, 1.f), 0).xyz, 0.0)).xyz); }

// 
half FFX_DNSR_Reflections_LoadRoughness(int2 pixel_coordinate)        { return 1.f; }
half FFX_DNSR_Reflections_LoadRoughnessHistory(int2 pixel_coordinate) { return 1.f; }
half FFX_DNSR_Reflections_SampleRoughnessHistory(float2 uv)           { return FBOF[U.framebuffers[4]].SampleLevel(SAM[U.linearSampler], float3(uv, 1.f), 0).r; }

// we has only static, lol
float2 FFX_DNSR_Reflections_LoadMotionVector(int2 pixel_coordinate) { return float2(0.f, 0.f); }

// currently, unsupported, we have no enough slots
half FFX_DNSR_Reflections_LoadRayLength(int2 pixel_coordinate) { return 1.f; }

//
half FFX_DNSR_Reflections_SampleNumSamplesHistory(float2 uv)                  { return tex2DBiLinear(1, uv, 1).w; }
half FFX_DNSR_Reflections_LoadNumSamples (int2 pixel_coordinate)              { return SETF[U.imageSets[1]][int3(pixel_coordinate, 0)].w; }
void FFX_DNSR_Reflections_StoreNumSamples(int2 pixel_coordinate, half  value) {        SETF[U.imageSets[1]][int3(pixel_coordinate, 0)].w = value; }

//
void FFX_DNSR_Reflections_LoadNeighborhood(int2 pixel_coordinate, out half3 radiance, out half variance, out half3 normal, out float depth, int2 screen_size) {
    depth = divW(FBOF[U.framebuffers[2]][int3(pixel_coordinate, 0)]).z;
    normal =     FBOF[U.framebuffers[3]][int3(pixel_coordinate, 0)].xyz;//normalize(mul(U.modelView[0], float4(FBOF[U.framebuffers[3]][int3(pixel_coordinate, 0)].xyz, 0.0)).xyz);
    radiance = SETF[0][int3(pixel_coordinate, 0)].xyz;
    variance = SETF[0][int3(pixel_coordinate, 0)].w;
}

//
half3 FFX_DNSR_Reflections_ScreenSpaceToViewSpace(in half3 v3) {
    return divW(mul(half4(v3, 1.f), U.perspectiveInverse));
}

//
half3 FFX_DNSR_Reflections_ViewSpaceToWorldSpace(in half4 v3) {
    return mul(v3, U.modelViewInverse[0]);
}

//
half4 FFX_DNSR_Reflections_WorldSpaceToScreenSpacePrevious(in half3 v3) {
    float4 pos = divW(mul(mul(half4(v3, 1.f), U.modelView[0]), U.perspective));
    return pos;
}

//
bool FFX_DNSR_Reflections_IsMirrorReflection(float roughness) { return roughness < 0.001f; };
bool FFX_DNSR_Reflections_IsGlossyReflection(int2 pixel_coordinate) { return true; };

*/
