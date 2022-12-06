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
#extension GL_EXT_shader_atomic_float : enable
//#extension ARB_shading_language_packing : enable

//
#include "include/hlsl_map.glsl"
#include "include/math.glsl"
#include "include/noire.glsl"

//
layout (location = _INDICES) out uvec4 fIndices;
layout (location = _DERRIVE) out uvec4 fDerrive;
layout (location = _BARY) out vec4 fBary;
layout (location = _POSITION) out vec4 fPos;
layout (location = _TEXCOORD) out vec4 fTex;
layout (location = _WPOS) out vec4 fWpos;

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
	const vec4 wpos = mat3x4(V[0].vPosition, V[1].vPosition, V[2].vPosition) * gl_BaryCoordEXT;

	//
	nrMaterial materialData = nrMaterial(V[0].vMaterialAddress);
	const vec4 diffuse = readTexData(materialData.diffuse, texcoord.xy);
	const vec4 PBR = readTexData(materialData.PBR, texcoord.xy);
	const float transparency = diffuse.a;

	//
	if (transparency <= 0.f) { discard; };

	//
	const f16mat4x2 derrivative = f16mat4x2(
		f16vec2(dFdx(gl_BaryCoordEXT.x), dFdy(gl_BaryCoordEXT.x)),
		f16vec2(dFdx(gl_BaryCoordEXT.y), dFdy(gl_BaryCoordEXT.y)),
		f16vec2(dFdx(gl_BaryCoordEXT.z), dFdy(gl_BaryCoordEXT.z)),
		f16vec2(dFdx(gl_FragCoord.z), dFdy(gl_FragCoord.z))
	);

	//
	fDerrive = uvec4(packFloat2x16(derrivative[0]), packFloat2x16(derrivative[1]), packFloat2x16(derrivative[2]), packFloat2x16(derrivative[3]));
	fTex = texcoord;
	fPos = vec4(gl_FragCoord.xy/vec2(width, height)*2.f-1.f, gl_FragCoord.z, 1.f);
	//fPos.y *= -1.f;
	fBary = vec4(gl_BaryCoordEXT, gl_FragCoord.z);
	fIndices = V[0].vIndices;
	fWpos = vec4(wpos.xyz, 1.f);
}
