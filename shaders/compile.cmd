call glslangValidator --client vulkan100 --target-env spirv1.6 test.comp -o test.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.vert -o triangle.vert.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.frag -o triangle.frag.spv
pause
