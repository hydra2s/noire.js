#version 460 core
#extension GL_ARB_separate_shader_objects : enable
#extension GL_EXT_fragment_shader_barycentric : enable

//
layout (location = 0) out uvec4 fIndices;
layout (location = 1) out vec4 fBary;
layout (location = 0) in flat uvec4 vIndices;

//
void main() {
	fBary = vec4(gl_BaryCoordEXT, gl_FragCoord.z);
	fIndices = vIndices;
}