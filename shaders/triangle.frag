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
#include "include/math.glsl"
#include "include/noire.glsl"

//
layout (location = 0) out uvec4 fIndices;
layout (location = 1) out vec4 fBary;
layout (location = 2) out vec4 fPos;
layout (location = 3) out vec4 fNormal;

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
	vec4 texcoord = mat3x4(V[0].vTexcoord, V[1].vTexcoord, V[2].vTexcoord) * gl_BaryCoordEXT;
	vec3 normal = mat3x3(V[0].vNormal, V[1].vNormal, V[2].vNormal) * gl_BaryCoordEXT;

	//
	nrMaterial materialData = nrMaterial(V[0].vMaterialAddress);
	const float transparency = materialData.diffuse.tex >= 0 ? texture(sampler2D(textures[nonuniformEXT(materialData.diffuse.tex)], samplers[nonuniformEXT(materialData.diffuse.sam)]), texcoord.xy).a : materialData.diffuse.col.a;

	//
	if (transparency <= 0.f) { discard; };

	//
	fPos = mat3x4(V[0].vPosition, V[1].vPosition, V[2].vPosition) * gl_BaryCoordEXT;
	fBary = vec4(gl_BaryCoordEXT, gl_FragCoord.z);
	fIndices = V[0].vIndices;
	fNormal = vec4(normalize(normal), 1.f);
}
