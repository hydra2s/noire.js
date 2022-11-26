#version 460 core
#extension GL_ARB_separate_shader_objects : enable

out gl_PerVertex {
	vec4 gl_Position;
};

layout (location = 0) out vec3 color;

const vec2 triangle[3] = { vec2(0.0, -0.5), vec2(0.5,  0.5), vec2(-0.5,  0.5 ) };
const vec3 colors[3] = { vec3(1.f, 0.f, 0.f), vec3(0.f, 1.f, 0.f), vec3(0.f, 0.f, 1.f) };

void main() {
	gl_Position = vec4(triangle[gl_VertexIndex], 0.0, 1.0);
    color = colors[gl_VertexIndex];
}