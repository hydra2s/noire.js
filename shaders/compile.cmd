call glslangValidator --client vulkan100 --target-env spirv1.6 test.comp -o test.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.comp -o triangle.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.vert -o triangle.vert.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.frag -o triangle.frag.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 postfact.comp -o postfact.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 denoise-prefilter.comp -o denoise-prefilter.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 denoise-reproject.comp -o denoise-reproject.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 denoise-resolve_temporal.comp -o denoise-resolve_temporal.comp.spv
::call dxc -fspv-entrypoint-name="main" -enable-16bit-types denoise-prefilter.comp.hlsl -DPASS_INDEX=0 -T cs_6_7 -fvk-use-scalar-layout -spirv -Fo denoise-prefilter.comp.spv
::call dxc -fspv-entrypoint-name="main" -enable-16bit-types denoise-reproject.comp.hlsl -DPASS_INDEX=1 -T cs_6_7 -fvk-use-scalar-layout -spirv -Fo denoise-reproject.comp.spv
::call dxc -fspv-entrypoint-name="main" -enable-16bit-types denoise-resolve_temporal.comp.hlsl -DPASS_INDEX=2 -T cs_6_7 -fvk-use-scalar-layout -spirv -Fo denoise-resolve_temporal.comp.spv
::pause
