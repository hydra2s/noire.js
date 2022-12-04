#version 460 core
#extension GL_ARB_separate_shader_objects : enable
#extension GL_GOOGLE_include_directive : enable
#extension GL_ARB_separate_shader_objects : enable
#extension GL_EXT_shader_explicit_arithmetic_types_int64 : enable
#extension GL_EXT_shader_explicit_arithmetic_types_int32 : enable
#extension GL_EXT_shader_explicit_arithmetic_types_int16 : enable
#extension GL_EXT_nonuniform_qualifier : enable
#extension GL_EXT_scalar_block_layout : enable
#extension GL_EXT_buffer_reference : enable
#extension GL_EXT_buffer_reference2 : enable
#extension GL_EXT_samplerless_texture_functions : enable
#extension GL_EXT_fragment_shader_barycentric : enable
#extension GL_EXT_demote_to_helper_invocation : enable
#extension GL_EXT_shader_explicit_arithmetic_types_float16 : enable

//
#include "include/hlsl_map.glsl"
#include "include/math.glsl"
#include "include/noire.glsl"

//
layout (location = 0) out uvec4 fIndices;
layout (location = 1) out vec4 fBary;
layout (location = 2) out vec4 fPos;
layout (location = 3) out vec4 fNormal;
layout (location = 4) out vec4 fPBR;

//
layout (location = 0) pervertexEXT in Inputs {
	uvec4 vIndices;
	vec4 vTexcoord;
	vec4 vPosition;
	vec3 vNormal;
	uint64_t vMaterialAddress;
} V[];

//
void main() {
	const vec4 texcoord = mat3x4(V[0].vTexcoord, V[1].vTexcoord, V[2].vTexcoord) * gl_BaryCoordEXT;
	const vec3 normal = mat3x3(V[0].vNormal, V[1].vNormal, V[2].vNormal) * gl_BaryCoordEXT;

	//
	nrMaterial materialData = nrMaterial(V[0].vMaterialAddress);
	const vec4 diffuse = readTexData(materialData.diffuse, texcoord.xy);
	const vec4 PBR = readTexData(materialData.PBR, texcoord.xy);
	const float transparency = diffuse.a;

	//
	if (transparency <= 0.f) { discard; };

	//
	fPos = vec4(gl_FragCoord.xy/vec2(width, height)*2.f-1.f, gl_FragCoord.z, 1.f);
	fPos.y *= -1.f;
	fBary = vec4(gl_BaryCoordEXT, gl_FragCoord.z);
	fIndices = V[0].vIndices;
	fNormal = vec4(normalize(normal), 1.f);
	fPBR = vec4(max(PBR.rgb, 0.0001f), 1.f);
}
