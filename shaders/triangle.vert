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
#extension GL_EXT_shader_explicit_arithmetic_types_float16 : enable

//
#include "include/math.glsl"
#include "include/noire.glsl"

//
out gl_PerVertex { vec4 gl_Position; };

//
layout (location = 0) pervertexEXT out Inputs {
	uvec4 vIndices;
	vec4 vTexcoord;
	vec4 vPosition;
	uint64_t vMaterialAddress;
};

//
void main() {
	const uvec4 sys = uvec4(instanceId, gl_DrawID, gl_VertexIndex/3, 0u);

	//
	nrNode nodeData = nrNode(nodeBuffer) + sys.x;
	nrMesh meshData = nrMesh(nodeData.meshBuffer);
	nrGeometry geometryData = nrGeometry(meshData.address) + sys.y;
	uint indices = readIndexData(geometryData.indice, gl_VertexIndex);
	//vec4 texcoord = readFloatData(geometryData.texcoord, indices);
	vec4 vertex = readFloatData(geometryData.vertex, indices);
	vec4 texcoord = readFloatData(geometryData.texcoord, indices);

	//
	vec4 _pos = ((vec4(vertex.xyz, 1.f) * nodeData.transform) * modelView) * perspective;
	gl_Position = _pos;
	vIndices = sys;
	vMaterialAddress = geometryData.materialAddress;
	vTexcoord = texcoord;
	vPosition = _pos;
}
