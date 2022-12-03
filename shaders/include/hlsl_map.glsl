//
#define uint2 uvec2
#define uint3 uvec3
#define uint4 uvec4

//
#define min16float float
#define min16float2 vec2
#define min16float3 vec3
#define min16float4 vec4

//
#define float2 vec2
#define float3 vec3
#define float4 vec4

//
uint f32tof16(in float f) { return uint(packHalf2x16(vec2(f,0.0))); };
uvec2 f32tof16(in vec2 f) { return uvec2(packHalf2x16(vec2(f.x,0.0)), packHalf2x16(vec2(f.y,0.0))); };
uvec3 f32tof16(in vec3 f) { return uvec3(packHalf2x16(vec2(f.x,0.0)), packHalf2x16(vec2(f.y,0.0)), packHalf2x16(vec2(f.z,0.0))); };
uvec4 f32tof16(in vec4 f) { return uvec4(packHalf2x16(vec2(f.x,0.0)), packHalf2x16(vec2(f.y,0.0)), packHalf2x16(vec2(f.z,0.0)), packHalf2x16(vec2(f.w,0.0))); };

//
float f16tof32(in uint f) { return unpackHalf2x16(f).x; };
vec2 f16tof32(in uvec2 f) { return vec2(unpackHalf2x16(f.x).x, unpackHalf2x16(f.y).x); };
vec3 f16tof32(in uvec3 f) { return vec3(unpackHalf2x16(f.x).x, unpackHalf2x16(f.y).x, unpackHalf2x16(f.z).x); };
vec4 f16tof32(in uvec4 f) { return vec4(unpackHalf2x16(f.x).x, unpackHalf2x16(f.y).x, unpackHalf2x16(f.z).x, unpackHalf2x16(f.w).x); };
