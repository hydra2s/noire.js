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
    vec4 originalOrigin;
    mat3x4 objectToWorld;
    mat3x4 worldToObject;
    vec3 originalNormal;
    vec3 surfaceNormal;
    vec3 dir;
};

//
RayTracedData rasterize(in uvec2 coord) {
    const vec3 bary = texelFetch(textures [framebuffers[1]], ivec2(coord), 0).xyz;
    const uvec4 sys = texelFetch(texturesU[framebuffers[0]], ivec2(coord), 0);
    const vec4 pos  = vec4(divW(texelFetch(textures [framebuffers[2]], ivec2(coord), 0)).xyz, 1.f);

    //
    RayTracedData rayData;
    rayData.normal = vec4(0.f, 0.f, 0.5f, 0.f);
    rayData.diffuse = vec4(0.f.xxx, 1.f);
    rayData.surfaceNormal = normalize((modelView * vec4(0.f, 0.f, 0.5f, 0.f)).xyz);
    rayData.originalOrigin = pos;

    //
    if (any(greaterThan(bary, 0.f.xxx))) {
        nrNode nodeData = nrNode(nodeBuffer) + sys.x;
        nrMesh meshData = nrMesh(nodeData.meshBuffer);
        nrGeometry geometryData = nrGeometry(meshData.address) + sys.y;
        uvec3 indices = readIndexData3(geometryData.indice, sys.z);
        vec4 texcoord = readFloatData3(geometryData.texcoord, indices) * bary;

        //
        nrMaterial materialData = nrMaterial(geometryData.materialAddress);

        //
        //rayData.objectToWorld = transpose(rayQueryGetIntersectionObjectToWorldEXT(rayQuery, true));
        //rayData.worldToObject = transpose(rayQueryGetIntersectionWorldToObjectEXT(rayQuery, true));
        //rayData.origin = vec4(vec4(rayQueryGetIntersectionObjectRayOriginEXT(rayQuery, true), 1.f) * rayData.objectToWorld, rayQueryGetIntersectionTEXT(rayQuery, true));

        vec4 _camera = divW(pos * inverse(perspective));
        vec4 _origin = divW(_camera * modelViewInverse);
        rayData.dir = normalize((modelView * normalize(_camera)).xyz);
        rayData.origin = _origin;
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        // Hosico
        // TODO: calculate normals
        rayData.originalNormal = normalize((readFloatData3(geometryData.normal, indices) * bary).xyz);
        rayData. surfaceNormal = normalize((
            inverse(mat4x4(nodeData.transform[0], nodeData.transform[1], nodeData.transform[2], vec4(0.f.xxx, 1.f))) * 
            vec4(rayData.originalNormal, 0.0f) 
        ).xyz);

        //
        rayData.surfaceNormal = faceforward(rayData.surfaceNormal, rayData.dir, rayData.surfaceNormal);

        //
        rayData.emissive = readTexData(materialData.emissive, texcoord.xy);
        rayData.diffuse = readTexData(materialData.diffuse, texcoord.xy);
        rayData.normal = readTexData(materialData.normal, texcoord.xy);;
        rayData.PBR = readTexData(materialData.PBR, texcoord.xy);
    }

    //
    return rayData;
}

//
RayTracedData rayTrace(in vec3 origin, in vec3 far, in vec3 dir) {
    RayTracedData rayData;
    rayData.normal = vec4(0.f, 0.f, 0.5f, 0.f);
    rayData.diffuse = vec4(0.f.xxx, 1.f);
    rayData.origin = vec4(far, 1.f);
    rayData.surfaceNormal = normalize((modelView * vec4(0.f, 0.f, 0.5f, 0.f)).xyz);
    rayData.dir = dir;

    //
    rayQueryEXT rayQuery;
    rayQueryInitializeEXT(rayQuery, accelerationStructureEXT(accStruct), gl_RayFlagsCullBackFacingTrianglesEXT, 0xFF, origin, 0.0001f, dir, 10000.f);

    //
    while(rayQueryProceedEXT(rayQuery)) {
        const vec2 bary_ = rayQueryGetIntersectionBarycentricsEXT(rayQuery, false);
        const vec3 bary = vec3(1.f - bary_.x - bary_.y, bary_.xy);
        const uvec4 sys = uvec4(rayQueryGetIntersectionInstanceIdEXT(rayQuery, false), rayQueryGetIntersectionGeometryIndexEXT(rayQuery, false), rayQueryGetIntersectionPrimitiveIndexEXT(rayQuery, false), 0u);
        const float T = rayQueryGetIntersectionTEXT(rayQuery, false);

        //
        nrNode nodeData = nrNode(nodeBuffer) + sys.x;
        nrMesh meshData = nrMesh(nodeData.meshBuffer);
        nrGeometry geometryData = nrGeometry(meshData.address) + sys.y;
        uvec3 indices = readIndexData3(geometryData.indice, sys.z);
        vec4 texcoord = readFloatData3(geometryData.texcoord, indices) * bary;

        //
        nrMaterial materialData = nrMaterial(geometryData.materialAddress);
        const float transparency = readTexData(materialData.diffuse, texcoord.xy).a;

        //
        if (transparency > 0.f) {
            rayQueryConfirmIntersectionEXT(rayQuery);
        }
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

        //
        vec4 _origin = vec4(vec4(rayQueryGetIntersectionObjectRayOriginEXT(rayQuery, true), 1.f) * rayData.objectToWorld, rayQueryGetIntersectionTEXT(rayQuery, true));
        //rayData.dir = normalize(rayData.origin.xyz - _origin.xyz);
        rayData.origin = _origin;
        
        //
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        // Hosico
        // TODO: calculate normals
        rayData.originalNormal = normalize((readFloatData3(geometryData.normal, indices) * bary).xyz);
        rayData. surfaceNormal = normalize((
            inverse(mat4x4(nodeData.transform[0], nodeData.transform[1], nodeData.transform[2], vec4(0.f.xxx, 1.f))) * 
            vec4(rayData.originalNormal, 0.0f) 
        ).xyz);

        //
        rayData.surfaceNormal = faceforward(rayData.surfaceNormal, rayData.dir, rayData.surfaceNormal);

        //
        rayData.emissive = readTexData(materialData.emissive, texcoord.xy);
        rayData.diffuse = readTexData(materialData.diffuse, texcoord.xy);
        rayData.normal = readTexData(materialData.normal, texcoord.xy);;
        rayData.PBR = readTexData(materialData.PBR, texcoord.xy);
    }

    //
    return rayData;
}
