
//
#ifndef _ENABLE_FXD
#define _ENABLE_FXD

//
float FFX_DNSR_Reflections_GetRandom(int2 pixel_coordinate) { return random_seeded(float2(pixel_coordinate), 0.0 + float(frameCount)) * 0.5f + 0.5f; }

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
min16float3 FFX_DNSR_Reflections_LoadRadianceReprojected(int2 pixel_coordinate) { return imageSetLoadF(_DOTHERS, pixel_coordinate, 0).xyz; }
min16float3 FFX_DNSR_Reflections_SampleRadianceHistory  (float2 uv)             { return imageSetLoadPrevLinF(_DIFFUSE, uv, 0).xyz;  }

//
void FFX_DNSR_Reflections_StoreRadianceReprojected   (int2 pixel_coordinate, min16float3 value)                               { imageSetStoreRGBF(_DOTHERS, pixel_coordinate, value, 0); };
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
min16float3 FFX_DNSR_Reflections_LoadWorldSpaceNormal(int2 pixel_coordinate)        { return normalize((/*modelView[0] **/ vec4(imageSetLoadF       (_DOTHERS, pixel_coordinate, 2).rgb, 0.0)).xyz); }
min16float3 FFX_DNSR_Reflections_LoadWorldSpaceNormalHistory(int2 pixel_coordinate) { return normalize((/*modelView[1] **/ vec4(imageSetLoadPrevF   (_DOTHERS, pixel_coordinate, 2).rgb, 0.0)).xyz); }
min16float3 FFX_DNSR_Reflections_SampleWorldSpaceNormalHistory(float2 uv)           { return normalize((/*modelView[1] **/ vec4(imageSetLoadPrevLinF(_DOTHERS, uv, 2).rgb, 0.0)).xyz); }

// 
min16float FFX_DNSR_Reflections_LoadRoughness(int2 pixel_coordinate)        { return imageSetLoadF   (_METAPBR, pixel_coordinate, 0).g; }
min16float FFX_DNSR_Reflections_LoadRoughnessHistory(int2 pixel_coordinate) { return imageSetLoadPrevF(_METAPBR, pixel_coordinate, 0).g; }
min16float FFX_DNSR_Reflections_SampleRoughnessHistory(float2 uv)           { return imageSetLoadPrevLinF(_METAPBR, uv, 0).g; }

//
min16float FFX_DNSR_Reflections_LoadRayLength (int2 pixel_coordinate)               { return imageSetLoadF   (_DREPROJ, pixel_coordinate, 0).w; }

//
min16float FFX_DNSR_Reflections_LoadNumSamples(int2 pixel_coordinate)               { return imageSetLoadF       (_DREPROJ, pixel_coordinate, 0).r; }
min16float FFX_DNSR_Reflections_SampleNumSamplesHistory(float2 uv)                  { return imageSetLoadPrevLinF(_DREPROJ, uv, 0).r; }
void FFX_DNSR_Reflections_StoreNumSamples(int2 pixel_coordinate, min16float  value) {        imageSetStoreRF     (_DREPROJ, pixel_coordinate, value, 0); }

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
