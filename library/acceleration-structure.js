import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
const bigIntMax = (...args) => args.reduce((m, e) => e > m ? e : m);
const bigIntMin = (...args) => args.reduce((m, e) => e < m ? e : m);

// TODO: user-define opaque flags support
class AccelerationStructure extends B.BasicObj {
    constructor(base, options) {
        super(base, null); this.cInfo = options;

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];

        //
        this.physicalDevice = physicalDeviceObj.handle[0];
        this.device = deviceObj.handle[0];
        this.asLevel = options.asLevel;

        //
        this.asGeometryInfo = this.asLevel == V.VK_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL_KHR ? new V.VkAccelerationStructureGeometryKHR({
            flags: (options.opaque ? V.VK_GEOMETRY_OPAQUE_BIT_KHR : 0),
            geometryType: V.VK_GEOMETRY_TYPE_INSTANCES_KHR,
            ["geometry:VkAccelerationStructureGeometryInstancesDataKHR"]: {
                sType: V.VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_GEOMETRY_INSTANCES_DATA_KHR,
                arrayOfPointers: false,
                ...options.instanced
            }
        }) : new V.VkAccelerationStructureGeometryKHR(new Array(options.geometries.length).fill({}).map((_, I)=>({
            flags: (options.geometries[I].opaque ? V.VK_GEOMETRY_OPAQUE_BIT_KHR : 0),
            geometryType: V.VK_GEOMETRY_TYPE_TRIANGLES_KHR,
            ["geometry:VkAccelerationStructureGeometryTrianglesDataKHR"]: {
                sType: V.VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_GEOMETRY_TRIANGLES_DATA_KHR,
                vertexFormat: V.VK_FORMAT_R32G32_SFLOAT,
                vertexData: 0n,
                vertexStride: 8,
                maxVertex: 3,
                indexType: V.VK_INDEX_TYPE_NONE_KHR,
                indexData: 0n,
                ...options.geometries[I].geometry
            }
        })));

        //
        const asBuildSizeGeometryInfo = new V.VkAccelerationStructureBuildGeometryInfoKHR({
            type: this.asLevel,
            flags: V.VK_BUILD_ACCELERATION_STRUCTURE_PREFER_FAST_TRACE_BIT_KHR,
            geometryCount: this.asGeometryInfo.length,
            pGeometries: this.asGeometryInfo
        });

        // 
        const asPrimitiveCount = new Uint32Array(this.asLevel == V.VK_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL_KHR ? [options.primitiveCount] : new Array(options.geometries.length).fill({}).map((_, I)=>(options.geometries[I].primitiveCount)));
        this.asBuildSizesInfo = new V.VkAccelerationStructureBuildSizesInfoKHR({});
        V.vkGetAccelerationStructureBuildSizesKHR(this.device, V.VK_ACCELERATION_STRUCTURE_BUILD_TYPE_DEVICE_KHR, asBuildSizeGeometryInfo, asPrimitiveCount, this.asBuildSizesInfo);

        //
        this.buffer = B.createTypedBuffer(this.physicalDevice, this.device, V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_STORAGE_BIT_KHR | V.VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT, this.asBuildSizesInfo.accelerationStructureSize);
        this.bufferBarrier = this.asLevel == V.VK_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL_KHR ? new V.VkBufferMemoryBarrier2({
            srcStageMask: V.VK_PIPELINE_STAGE_2_ACCELERATION_STRUCTURE_BUILD_BIT_KHR,
            srcAccessMask: V.VK_ACCESS_2_ACCELERATION_STRUCTURE_WRITE_BIT_KHR,
            dstStageMask: V.VK_PIPELINE_STAGE_2_COMPUTE_SHADER_BIT,
            dstAccessMask: V.VK_ACCESS_2_ACCELERATION_STRUCTURE_READ_BIT_KHR | V.VK_ACCESS_2_SHADER_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
            $buffer: this.buffer,
            offset: 0,
            size: this.asBuildSizesInfo.accelerationStructureSize
        }) : new V.VkBufferMemoryBarrier2({
            srcStageMask: V.VK_PIPELINE_STAGE_2_ACCELERATION_STRUCTURE_BUILD_BIT_KHR,
            srcAccessMask: V.VK_ACCESS_2_ACCELERATION_STRUCTURE_WRITE_BIT_KHR | V.VK_ACCESS_2_ACCELERATION_STRUCTURE_READ_BIT_KHR,
            dstStageMask: V.VK_PIPELINE_STAGE_2_COMPUTE_SHADER_BIT,
            dstAccessMask: V.VK_ACCESS_2_ACCELERATION_STRUCTURE_READ_BIT_KHR | V.VK_ACCESS_2_SHADER_READ_BIT,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
            $buffer: this.buffer,
            offset: 0,
            size: this.asBuildSizesInfo.accelerationStructureSize
        });

        //
        V.vkCreateAccelerationStructureKHR(this.device, new V.VkAccelerationStructureCreateInfoKHR({
            $buffer: this.buffer,
            size: this.asBuildSizesInfo.accelerationStructureSize,
            type: this.asLevel
        }), null, this.handle = new BigUint64Array(1));

        //
        this.scratchMemory = B.createTypedBuffer(this.physicalDevice, this.device, V.VK_BUFFER_USAGE_STORAGE_BUFFER_BIT | V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_STORAGE_BIT_KHR | V.VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT, bigIntMax(this.asBuildSizesInfo.buildScratchSize, this.asBuildSizesInfo.updateScratchSize));
        this.scratchBarrier = new V.VkBufferMemoryBarrier2({
            srcStageMask: V.VK_PIPELINE_STAGE_2_ACCELERATION_STRUCTURE_BUILD_BIT_KHR,
            srcAccessMask: V.VK_ACCESS_2_ACCELERATION_STRUCTURE_WRITE_BIT_KHR,
            dstStageMask: V.VK_PIPELINE_STAGE_2_COMPUTE_SHADER_BIT | V.VK_PIPELINE_STAGE_2_ACCELERATION_STRUCTURE_BUILD_BIT_KHR,
            dstAccessMask: V.VK_ACCESS_2_ACCELERATION_STRUCTURE_READ_BIT_KHR | V.VK_ACCESS_2_SHADER_READ_BIT | V.VK_ACCESS_2_ACCELERATION_STRUCTURE_READ_BIT_KHR,
            srcQueueFamilyIndex: ~0,
            dstQueueFamilyIndex: ~0,
            $buffer: this.scratchMemory,
            offset: 0,
            size: bigIntMax(this.asBuildSizesInfo.buildScratchSize, this.asBuildSizesInfo.updateScratchSize)
        });

        //
        deviceObj.AccelerationStructures[this.handle[0]] = this;
    }

    getDeviceAddress() {
        return this.deviceAddress || (this.deviceAddress = B.getAcceelerationStructureAddress(this.device, this.handle[0], this.asBuildSizesInfo.accelerationStructureSize));
    }

    cmdBuild(cmdBuf, geometries, mode = V.VK_BUILD_ACCELERATION_STRUCTURE_MODE_BUILD_KHR) {
        const asBufferBarriers = new V.VkBufferMemoryBarrier2([this.bufferBarrier, this.scratchBarrier]);
        const asBuildGeometryInfo = new V.VkAccelerationStructureBuildGeometryInfoKHR({
            type: this.asLevel,
            flags: V.VK_BUILD_ACCELERATION_STRUCTURE_PREFER_FAST_TRACE_BIT_KHR,
            mode: V.VK_BUILD_ACCELERATION_STRUCTURE_MODE_BUILD_KHR,
            srcAccelerationStructure: V.VK_BUILD_ACCELERATION_STRUCTURE_MODE_UPDATE_KHR ? this.handle[0] : 0n,
            dstAccelerationStructure: this.handle[0],
            geometryCount: this.asGeometryInfo.length,
            pGeometries: this.asGeometryInfo,
            scratchData: B.getBufferDeviceAddress(this.device, this.scratchMemory)
        });
        const asBuildRangeInfo = new V.VkAccelerationStructureBuildRangeInfoKHR(new Array(geometries.length).fill({}).map((_, I)=>({
            primitiveCount: 1,
            primitiveOffset: 0,
            firstVertex: 0,
            transformOffset: 0,
            ...geometries[I]
        })));

        // TODO: multiple bottom levels support
        const asBuildRangeInfoPtr = new BigUint64Array([ asBuildRangeInfo.address() ]);
        V.vkCmdBuildAccelerationStructuresKHR(cmdBuf, 1, asBuildGeometryInfo, asBuildRangeInfoPtr);
        V.vkCmdPipelineBarrier2(cmdBuf, new V.VkDependencyInfoKHR({ bufferMemoryBarrierCount: asBufferBarriers.length, pBufferMemoryBarriers: asBufferBarriers }));
    }
};

//
class TopLevelAccelerationStructure extends AccelerationStructure {
    constructor(base, options) {
        super(base, {
            memoryAllocator: options.memoryAllocator,
            asLevel: V.VK_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL_KHR,
            opaque: options.opaque,
            instanced: options.instanced?.length ? {} : options.instanced,
            primitiveCount: options.instanced?.length || options.primitiveCount
        });

        //
        const deviceObj = B.Handles[this.base[0]];
        const physicalDeviceObj = B.Handles[deviceObj.base[0]];
        const memoryAllocatorObj = B.Handles[this.cInfo.memoryAllocator[0] || this.cInfo.memoryAllocator];

        // 
        this.instanced = options.instanced?.length ? new V.VkAccelerationStructureInstanceKHR(options.instanced) : new V.VkAccelerationStructureInstanceKHR(options.primitiveCount);
        this.instanceBuffer = memoryAllocatorObj.allocateMemory({ isHost: true }, deviceObj.createBuffer({ size: (options.instanced?.length || options.primitiveCount) * V.VkAccelerationStructureInstanceKHR.byteLength }));
        this.instanceBufferGPU = memoryAllocatorObj.allocateMemory({ isDevice: true }, deviceObj.createBuffer({ size: (options.instanced?.length || options.primitiveCount) * V.VkAccelerationStructureInstanceKHR.byteLength, usage: V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_STORAGE_BIT_KHR | V.VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR }));
        V.memcpy(this.instanceBuffer.map(), this.instanced.address(), (options.instanced?.length || options.primitiveCount) * V.VkAccelerationStructureInstanceKHR.byteLength);
        this.instanceBuffer.unmap();

        //
        if (this.instanceBuffer && options.instanced?.length && !options.instanced.data) {
            this.asGeometryInfo["geometry:VkAccelerationStructureGeometryInstancesDataKHR"].data = this.instanceBufferGPU.getDeviceAddress();
        }
    }

    cmdBuild(cmdBuf, geometries) {
        if (this.instanceBuffer) {
            this.instanceBuffer.cmdCopyToBuffer(cmdBuf, this.instanceBufferGPU.handle[0], [{srcOffset: 0, dstOffset: 0, size: this.instanceBuffer.cInfo.size}]);
        }
        super.cmdBuild(cmdBuf, geometries);
    }

    // 
    uploadInstanceData(instanced) {
        if (instanced?.length) {
            this.instanced = new V.VkAccelerationStructureInstanceKHR(instanced);
            //this.instanceBuffer.map().set(ArrayBuffer.fromAddress(this.instanced.address(), instanced.length * V.VkAccelerationStructureInstanceKHR.byteLength));
            V.memcpy(this.instanceBuffer.map(), this.instanced.address(), instanced.length * V.VkAccelerationStructureInstanceKHR.byteLength);
            this.instanceBuffer.unmap();
        }
    }
};

//
class BottomLevelAccelerationStructure extends AccelerationStructure {
    constructor(base, options) {
        super(base, {
            asLevel: V.VK_ACCELERATION_STRUCTURE_TYPE_BOTTOM_LEVEL_KHR, ...options
        });
    }
};

//
B.AccelerationStructure = AccelerationStructure;
B.TopLevelAccelerationStructure = TopLevelAccelerationStructure;
B.BottomLevelAccelerationStructure = BottomLevelAccelerationStructure;

//
export default {
    AccelerationStructure,
    TopLevelAccelerationStructure,
    BottomLevelAccelerationStructure
};
