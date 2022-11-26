#version 460 core
#extension GL_ARB_separate_shader_objects : enable

layout (location = 0) out vec4 fragColor;

layout (location = 0) in vec3 color;



void main() {
	fragColor = vec4(color, 1.0);
}