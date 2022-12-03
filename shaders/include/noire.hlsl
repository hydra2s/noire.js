//
struct nrUniformData { 
    float4x4 perspective;
    float4x4 perspectiveInverse;
    float4x4 modelView[2];
    float4x4 modelViewInverse[2];
    uint64_t accStruct;
    uint64_t nodeBuffer;
    uint instanceCount;
    uint16_t width, height;
    uint16_t windowWidth, windowHeight;
    uint16_t framebuffers[6];
    uint16_t imageSets[4];
    uint frameCount;
    uint linearSampler;
};

//
[[vk::binding(0, 0)]]   Texture2DArray<half4> FBOF[] : register(t0);
[[vk::binding(0, 0)]] RWTexture2DArray<float4> SETF[] : register(u0);
[[vk::binding(0, 2)]] ConstantBuffer<nrUniformData> U : register(b0);

//
half FFX_DNSR_Reflections_SampleNumSamplesHistory(float2 uv) { return 1.f; }
half FFX_DNSR_Reflections_LoadNumSamples(int2 pixel_coordinate) { return 1.f; }

//
float FFX_DNSR_Reflections_GetRandom(int2 pixel_coordinate) { return 1.f; }
float FFX_DNSR_Reflections_LoadDepth(int2 pixel_coordinate) { return 1.f; }

//
float FFX_DNSR_Shadows_GetDepthSimilaritySigma() { return 0.f; }
float FFX_DNSR_Reflections_LoadDepthHistory(int2 pixel_coordinate) { return 1.f; }
float FFX_DNSR_Reflections_SampleDepthHistory(float2 uv) { return 1.f; }
float FFX_DNSR_Reflections_GetLinearDepth(float2 uv, float history) { return 1.f; };

//
half3 FFX_DNSR_Reflections_LoadRadiance(int2 pixel_coordinate) { return SETF[0].Load(int4(pixel_coordinate, 0, 0)); }
half3 FFX_DNSR_Reflections_LoadRadianceReprojected(int2 pixel_coordinate) { return SETF[0].Load(int4(pixel_coordinate, 2, 0)); }
half3 FFX_DNSR_Reflections_LoadRadianceHistory(int2 pixel_coordinate) { return half3(0.f.xxx); }
half3 FFX_DNSR_Reflections_SampleRadianceHistory(float2 uv) { return half3(0.f.xxx); }

//
half3 FFX_DNSR_Reflections_SampleAverageRadiance(float2 uv) { return half3(0.f.xxx); }
half3 FFX_DNSR_Reflections_SamplePreviousAverageRadiance(float2 uv) { return half3(0.f.xxx); }

//
half3 FFX_DNSR_Reflections_LoadWorldSpaceNormal(int2 pixel_coordinate) { return half3(0.f.xxx); }
half3 FFX_DNSR_Reflections_LoadWorldSpaceNormalHistory(int2 pixel_coordinate) { return half3(0.f.xxx); }
half3 FFX_DNSR_Reflections_SampleWorldSpaceNormalHistory(float2 uv) { return half3(0.f.xxx); }

//
half FFX_DNSR_Reflections_LoadRoughness(int2 pixel_coordinate) { return 0.f; }
half FFX_DNSR_Reflections_LoadRoughnessHistory(int2 pixel_coordinate) { return 0.f; }
half FFX_DNSR_Reflections_SampleRoughnessHistory(float2 uv) { return 0.f; }

// we has only static, lol
float2 FFX_DNSR_Reflections_LoadMotionVector(int2 pixel_coordinate) { return float2(0.f, 0.f); }

//
half FFX_DNSR_Reflections_LoadRayLength(int2 pixel_coordinate) { return 0.f; }
half FFX_DNSR_Reflections_LoadVariance(int2 pixel_coordinate) { return 0.f; }
half FFX_DNSR_Reflections_SampleVarianceHistory(float2 uv) { return 0.f; }

//
void FFX_DNSR_Reflections_StoreRadianceReprojected(int2 pixel_coordinate, half3 value) {  }
void FFX_DNSR_Reflections_StoreAverageRadiance(int2 pixel_coordinate, half3 value) {  }
void FFX_DNSR_Reflections_StoreVariance(int2 pixel_coordinate, half value) {  }
void FFX_DNSR_Reflections_StoreNumSamples(int2 pixel_coordinate, half value) {  }
void FFX_DNSR_Reflections_StorePrefilteredReflections(int2 pixel_coordinate, half3 radiance, half variance) {  }
void FFX_DNSR_Reflections_StoreTemporalAccumulation(int2 pixel_coordinate, half3 new_signal, half3 new_variance) {  };

//
void FFX_DNSR_Reflections_LoadNeighborhood(int2 pixel_coordinate, out half3 radiance, out half variance, out half3 normal, out float depth, int2 screen_size) {
    
}

//
half3 FFX_DNSR_Reflections_ScreenSpaceToViewSpace(in half3 v3) {
    return v3;
}

//
half4 FFX_DNSR_Reflections_ViewSpaceToWorldSpace(in half3 v3) {
    return half4(v3, 1.f);
}

//
half4 FFX_DNSR_Reflections_WorldSpaceToScreenSpacePrevious(in half3 v3) {
    return half4(v3, 1.f);
}

//
bool FFX_DNSR_Reflections_IsMirrorReflection(float roughness) { return true; };
bool FFX_DNSR_Reflections_IsGlossyReflection(int2 pixel_coordinate) { return true; };

//
float4 tex2DBiLinear( in uint F, in float2 texCoord_f, in int layer)
{
    const int3 texCoord_i = int3(texCoord_f * float2(U.width, U.height), layer);
    const float4 p0q0 = SETF[U.imageSets[F]][texCoord_i];
    const float4 p1q0 = SETF[U.imageSets[F]][texCoord_i + int3(1, 0, 0)];
    const float4 p0q1 = SETF[U.imageSets[F]][texCoord_i + int3(0, 1, 0)];
    const float4 p1q1 = SETF[U.imageSets[F]][texCoord_i + int3(1, 1, 0)];
    const float a = frac( texCoord_f.x * U.width - 0.5f ); // Get Interpolation factor for X direction.
    const float4 pInterp_q0 = lerp( p0q0, p1q0, a ); // Interpolates top row in X direction.
    const float4 pInterp_q1 = lerp( p0q1, p1q1, a ); // Interpolates bottom row in X direction.
    const float b = frac( texCoord_f.y * U.height - 0.5f );// Get Interpolation factor for Y direction.
    return lerp( pInterp_q0, pInterp_q1, b ); // Interpolate in Y direction.
};
