//
#define A_HLSL
#define A_GPU
#define A_HLSL_6_2
#define A_HALF
#define A_LONG

// broken AU1_AW4
//#define A_WAVE
//#define A_NO_16_BIT_CAST

//
#include "include/noire.hlsl"

//
#include "include/ffx_a.h"
#include "include/ffx_denoiser_reflections_resolve_temporal.h"

//
[numthreads(16, 16, 1)]
void main(uint2 gid : SV_GroupID, uint2 gtid : SV_GroupThreadID, uint2 did : SV_DispatchThreadID) {
    const uint STEP_SIZE = 2;

    
}
