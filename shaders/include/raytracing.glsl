//
struct RayTracedData {
    vec4 diffuse;
    vec4 normal;
    vec4 PBR;
    vec4 emissive;
    uvec4 indices;
    uint64_t materialAddress;
    vec2 texcoord;
    vec4 origin;
    mat3x4 objectToWorld;
    mat3x4 worldToObject;
};

//
RayTracedData rayTrace(in vec3 origin, in vec3 dir) {
    RayTracedData rayData;
    rayData.normal = vec4(0.f, 0.f, 0.5f, 0.f);
    rayData.diffuse = vec4(0.f.xxx, 1.f);

    //
    rayQueryEXT rayQuery;
    rayQueryInitializeEXT(rayQuery, accelerationStructureEXT(accStruct), gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, origin, 0.0001f, dir, 10000.f);

    //
    while(rayQueryProceedEXT(rayQuery)) {
        rayQueryConfirmIntersectionEXT(rayQuery);
    }

    //
    if (rayQueryGetIntersectionTypeEXT(rayQuery, true) == gl_RayQueryCommittedIntersectionTriangleEXT) {
        const vec2 bary_ = rayQueryGetIntersectionBarycentricsEXT(rayQuery, true);
        const vec3 bary = vec3(1.f - bary_.x - bary_.y, bary_.xy);
        const uvec4 sys = uvec4(rayQueryGetIntersectionInstanceIdEXT(rayQuery, true), rayQueryGetIntersectionGeometryIndexEXT(rayQuery, true), rayQueryGetIntersectionPrimitiveIndexEXT(rayQuery, true), 0u);

        //
        nrNode nodeData = nrNode(nodeBuffer) + sys.x;
        nrMesh meshData = nrMesh(nodeData.meshBuffer);
        nrGeometry geometryData = nrGeometry(meshData.address) + sys.y;
        uvec3 indices = readIndexData3(geometryData.indice, sys.z);
        vec4 texcoord = readFloatData3(geometryData.texcoord, indices) * bary;

        //
        nrMaterial materialData = nrMaterial(geometryData.materialAddress);

        //
        rayData.objectToWorld = transpose(rayQueryGetIntersectionObjectToWorldEXT(rayQuery, true));
        rayData.worldToObject = transpose(rayQueryGetIntersectionWorldToObjectEXT(rayQuery, true));
        rayData.origin = vec4(vec4(rayQueryGetIntersectionObjectRayOriginEXT(rayQuery, true), 1.f) * rayData.objectToWorld, rayQueryGetIntersectionTEXT(rayQuery, true));
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        //
        rayData.emissive = materialData.emissive.tex >= 0 ? texture(sampler2D(textures[materialData.emissive.tex], samplers[materialData.emissive.sam]), texcoord.xy) : materialData.emissive.col;
        rayData.diffuse = materialData.diffuse.tex >= 0 ? texture(sampler2D(textures[materialData.diffuse.tex], samplers[materialData.diffuse.sam]), texcoord.xy) : materialData.diffuse.col;
        rayData.normal = materialData.normal.tex >= 0 ? texture(sampler2D(textures[materialData.normal.tex], samplers[materialData.normal.sam]), texcoord.xy) : materialData.normal.col;
        rayData.PBR = materialData.PBR.tex >= 0 ? texture(sampler2D(textures[materialData.PBR.tex], samplers[materialData.PBR.sam]), texcoord.xy) : materialData.PBR.col;
    }

    return rayData;
}