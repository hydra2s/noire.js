call glslangValidator --client vulkan100 --target-env spirv1.6 test.comp -o test.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.comp -o triangle.comp.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.vert -o triangle.vert.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 triangle.frag -o triangle.frag.spv
call glslangValidator --client vulkan100 --target-env spirv1.6 final.comp -o final.comp.spv
call dxc -fspv-entrypoint-name="main" -enable-16bit-types denoise-phase.comp.hlsl -DPASS_INDEX=0 -T cs_6_7 -fvk-use-scalar-layout -spirv -Fo denoise-phase.comp.spv
::call dxc -fspv-entrypoint-name="main" -enable-16bit-types denoise-phase.comp.hlsl -DPASS_INDEX=1 -T cs_6_7 -fvk-use-scalar-layout -spirv -Fo denoise-phase-1.comp.spv
::call dxc -fspv-entrypoint-name="main" -enable-16bit-types denoise-phase.comp.hlsl -DPASS_INDEX=2 -T cs_6_7 -fvk-use-scalar-layout -spirv -Fo denoise-phase-2.comp.spv
::pause
