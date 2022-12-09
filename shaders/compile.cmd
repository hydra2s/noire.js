call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.comp -o triangle.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.vert -o triangle.vert.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.frag -o triangle.frag.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 postfact.comp -o postfact.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 precache.comp -o precache.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 final.comp -o final.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 reprojection.comp -o reprojection.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 filter.comp -o filter.comp.spv
::pause
