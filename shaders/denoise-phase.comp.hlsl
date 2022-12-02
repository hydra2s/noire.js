

//
struct nrUniformData {
    float4x4 perspective;
    float4x4 perspectiveInverse;
    float4x4 modelView;
    float4x4 modelViewInverse;
    uint64_t accStruct;
    uint64_t nodeBuffer;
    uint instanceCount;
    uint16_t width, height;
    uint16_t windowWidth, windowHeight;
    uint16_t _[2];
    uint16_t framebuffers[8];
    uint frameCount;
    uint linearSampler;
};

//
[[vk::binding(0, 0)]]   Texture2D<float4> texData[] : register(t0);
[[vk::binding(0, 0)]] RWTexture2D<float4> imgData[] : register(u0);
[[vk::binding(0, 2)]] ConstantBuffer<nrUniformData> U : register(b0);

uint FFX_DNSR_Shadows_ReadTileMetaData(in uint offset) {
    return 0u;
}

int2 FFX_DNSR_Shadows_GetBufferDimensions() {
    return int2(U.width, U.height);
}

float2 FFX_DNSR_Shadows_GetInvBufferDimensions() {
    return 1.f / float2(U.width, U.height);
}

float4x4 FFX_DNSR_Shadows_GetProjectionInverse() {
    return U.perspectiveInverse;
}

float FFX_DNSR_Shadows_ReadDepth(in int2 did) {
    return texData[U.framebuffers[2]].Load(int3(did, 0)).z;
}

float16_t3 FFX_DNSR_Shadows_ReadNormals(in int2 did) {
    return float16_t3(imgData[U.framebuffers[5]][did].xyz);
}

static int _channel = 0;

float16_t2 FFX_DNSR_Shadows_ReadInput(in int2 did) {
    return float16_t2(0.hf, 0.hf);//float16_t2(imgData[U.framebuffers[3]][did][_channel], 0.hf);
}

//void FFX_DNSR_Shadows_LoadWithOffset(in int2 did, inout int2 offset_0, inout float3 normals_0, inout float3 input_0, inout float depth_0) {
    //return imgData.Load<float4>(did + offset_0);
//}

bool FFX_DNSR_Shadows_IsShadowReciever(in int2 did) {
    return true;
}

float FFX_DNSR_Shadows_GetDepthSimilaritySigma() {
    return 0.f;
}

//
#include "include/ffx_denoiser_shadows_filter.h"

//
[numthreads(16, 16, 1)]
void main(uint2 gid : SV_GroupID, uint2 gtid : SV_GroupThreadID, uint2 did : SV_DispatchThreadID) {
    const uint STEP_SIZE = 2;

    // make RGB diffuse light
    _channel = 0; bool rWriteOutput = false; float2 R = FFX_DNSR_Shadows_FilterSoftShadowsPass(gid, gtid, did, rWriteOutput, PASS_INDEX, STEP_SIZE);
    //_channel = 1; bool gWriteOutput = false; float2 G = FFX_DNSR_Shadows_FilterSoftShadowsPass(gid, gtid, did, gWriteOutput, PASS_INDEX, STEP_SIZE);
    //_channel = 2; bool bWriteOutput = false; float2 B = FFX_DNSR_Shadows_FilterSoftShadowsPass(gid, gtid, did, bWriteOutput, PASS_INDEX, STEP_SIZE);

    //
    float mR = pow(abs(R.x), max(1.2f - R.y, 1.0f));
    //float mG = pow(abs(G.x), max(1.2f - G.y, 1.0f));
    //float mB = pow(abs(B.x), max(1.2f - B.y, 1.0f));

    //
    if (PASS_INDEX == 2) {
        imgData[U.framebuffers[4]][did].xyz = float3(mR, mR, mR);
    }
}
