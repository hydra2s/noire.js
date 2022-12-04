//
struct RayTracedData {
    f16vec4 diffuse;
    f16vec4 normal;
    f16vec4 PBR;
    f16vec4 emissive;
    uvec4 indices;
    uint64_t materialAddress;
    vec2 texcoord;
    vec4 origin;
    //mat3x4 objectToWorld;
    //mat3x4 worldToObject;
    vec3 surfaceNormal;
    vec3 biNormal;
    vec3 dir;
    vec3 bary;
    vec3 tangent;
};

// A vot HER! More FPS drop...
//layout (scalar) shared RayTracedData RDATA[32][6];
//#define rayData RDATA[gl_LocalInvocationID.x][gl_LocalInvocationID.y]

//
RayTracedData rayData;

//
void rasterize(in uvec2 coord) {
    const vec3 bary = texelFetch(FBOF[framebuffers[1]], ivec3(coord, 0), 0).xyz;
    const uvec4 sys = texelFetch(FBOU[framebuffers[0]], ivec3(coord, 0), 0);

    //
    rayData.normal = f16vec4(0.f, 0.f, 0.5f, 0.f);
    rayData.diffuse = f16vec4(0.f.xxx, 1.f);
    rayData.surfaceNormal = normalize((modelView[0] * vec4(0.f, 0.f, 0.5f, 0.f)).xyz);
    rayData.bary = vec3(0.f.xxx);

    //
    vec4 _camera = divW(vec4((vec2(coord)/vec2(width, height)*2.f-1.f)*(1.f, 1.f), 1.f, 1.f) * inverse(perspective));
    vec4 _origin = (_camera * modelViewInverse[0]);
    rayData.dir = normalize((modelView[0] * vec4(normalize(_camera.xyz), 0.f)).xyz);
    rayData.origin = _origin;
    rayData.bary = bary;

    //
    if (any(greaterThan(bary, 0.0001f.xxx))) {
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

        //
        vec4 pos = divW(texelFetch(FBOF[framebuffers[2]], ivec3(coord, 0), 0));
        vec4 _camera = divW(pos * inverse(perspective));
        vec4 _origin = divW(_camera * modelViewInverse[0]);
        rayData.dir = normalize((modelView[0] * vec4(normalize(_camera.xyz), 0.f)).xyz);
        rayData.origin = _origin;

        //
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        // Hosico
        const vec3 NOR = normalize((readFloatData3(geometryData.normal, indices) * bary).xyz);
        rayData. surfaceNormal = normalize((nodeData.transformInverse * vec4(NOR, 0.0f)).xyz);
        rayData. surfaceNormal = faceforward(rayData.surfaceNormal, rayData.dir, rayData.surfaceNormal);

        // TOO PISSFUL for FPS
        const vec4 TAN = readFloatData3(geometryData.tangent, indices) * bary;
        rayData.tangent.xyz = normalize((nodeData.transformInverse * vec4(normalize(TAN.xyz), 0.f)).xyz) * TAN.w;
        rayData.tangent.xyz = normalize(rayData.tangent.xyz - dot(rayData.tangent.xyz, rayData.surfaceNormal) * rayData.surfaceNormal);
        //rayData. tangent.xyz = faceforward(rayData.tangent.xyz, rayData.dir, rayData.tangent.xyz);

        //
        rayData.biNormal = normalize(cross(rayData.tangent.xyz, rayData.surfaceNormal));

        //
        rayData.emissive = readTexData(materialData.emissive, texcoord.xy);
        rayData.diffuse = readTexData(materialData.diffuse, texcoord.xy);
        rayData.normal = readTexData(materialData.normal, texcoord.xy);;
        rayData.PBR = readTexData(materialData.PBR, texcoord.xy);
        rayData.diffuse.xyz = pow(rayData.diffuse.xyz, 2.2hf.xxx);
    } else {
        rayData.bary = vec3(0.f);
    }

    //
    //return rayData;
}

//
void rayTrace(in vec3 origin, in vec3 far, in vec3 dir) {
    rayData.normal = f16vec4(0.f, 0.f, 0.5f, 0.f);
    rayData.diffuse = f16vec4(0.f.xxx, 1.f);
    rayData.origin = vec4(far, 1.f);
    rayData.surfaceNormal = normalize((modelView[0] * vec4(0.f, 0.f, 0.5f, 0.f)).xyz);
    rayData.dir = dir;
    rayData.bary = vec3(0.f.xxx);

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
        //rayData.objectToWorld = transpose(rayQueryGetIntersectionObjectToWorldEXT(rayQuery, true));
        //rayData.worldToObject = transpose(rayQueryGetIntersectionWorldToObjectEXT(rayQuery, true));

        //
        vec4 vertex = readFloatData3(geometryData.vertex, indices) * bary;
        vec4 _origin = vec4(vertex.xyz, 1.f) * nodeData.transform; //vec4(rayQueryGetIntersectionObjectToWorldEXT(rayQuery, true) * vec4(rayQueryGetIntersectionObjectRayOriginEXT(rayQuery, true), 1.f), rayQueryGetIntersectionTEXT(rayQuery, true));
        //rayData.dir = normalize(rayData.origin.xyz - _origin.xyz);
        rayData.origin = _origin;
        rayData.bary = bary;

        //
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        // Hosico
        const vec3 NOR = normalize((readFloatData3(geometryData.normal, indices) * bary).xyz);
        rayData. surfaceNormal = normalize((nodeData.transformInverse * vec4(NOR, 0.0f)).xyz);
        rayData. surfaceNormal = faceforward(rayData.surfaceNormal, rayData.dir, rayData.surfaceNormal);

        // TOO PISSFUL for FPS
        const vec4 TAN = readFloatData3(geometryData.tangent, indices) * bary;
        rayData.tangent.xyz = normalize((nodeData.transformInverse * vec4(normalize(TAN.xyz), 0.f)).xyz) * TAN.w;
        rayData.tangent.xyz = normalize(rayData.tangent.xyz - dot(rayData.tangent.xyz, rayData.surfaceNormal) * rayData.surfaceNormal);
        //rayData. tangent.xyz = faceforward(rayData.tangent.xyz, rayData.dir, rayData.tangent.xyz);

        //
        rayData.biNormal = normalize(cross(rayData.tangent.xyz, rayData.surfaceNormal));

        //
        rayData.emissive = readTexData(materialData.emissive, texcoord.xy);
        rayData.diffuse = readTexData(materialData.diffuse, texcoord.xy);
        rayData.normal = readTexData(materialData.normal, texcoord.xy);;
        rayData.PBR = readTexData(materialData.PBR, texcoord.xy);
        rayData.diffuse.xyz = pow(rayData.diffuse.xyz, 2.2hf.xxx);
    }

    //
    //return rayData;
}

bool shadowTrace(in vec3 origin, in vec3 far, in vec3 dir) {
    rayQueryEXT rayQuery;
    rayQueryInitializeEXT(rayQuery, accelerationStructureEXT(accStruct), gl_RayFlagsCullBackFacingTrianglesEXT | gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, origin, 0.0001f, dir, distance(origin, far));

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
        return true;
    }

    //
    return false;
}

//
struct GIData {
    vec4 color;
};

//
GIData globalIllumination() {
    const vec3 worldNormal = rayData.surfaceNormal;

    //
    const vec4 lightPos = vec4(0, 100, 10, 1);
    vec3 lightDir = normalize(lightPos.xyz - rayData.origin.xyz);
    vec3 lightCol = 8.f.xxx;
    float diff = sqrt(max(dot(rayData.surfaceNormal, lightDir), 0.0));

    //
    const float epsilon = 0.001f * pow(texelFetch(FBOF[framebuffers[1]], ivec3(gl_GlobalInvocationID.xy, 0), 0).z, 256.f);
    const vec3 diffuseCol = rayData.diffuse.xyz * (diff + 0.2f) * 1.f;

    //
    vec4 fcolor = vec4(0.f.xxx, 1.f);
    vec4 energy = vec4(1.f.xxx, 1.f);

    //
    bool shadowed = true;
    float reflCoef = 1.f;
    vec3 reflDir = normalize(rayData.dir);
    vec3 reflCol = 1.f.xxx;

    //
    vec2 C = vec2(gl_GlobalInvocationID.xy);
    float F = frameCount % 256;
//lcts
    //

    bool hasHit = false;
    for (int I=0;I<2;I++) {
        if ((hasHit = any(greaterThan(rayData.bary, 0.0001f.xxx))) && dot(energy.xyz, 1.f.xxx) > 0.001f) {
            // shading
                lightDir = normalize(lightPos.xyz - rayData.origin.xyz);
                reflCol = 1.f.xxx;

                // TODO: fix negative normal
                mat3x3 TBN = mat3x3(rayData.tangent.xyz, rayData.biNormal.xyz, rayData.surfaceNormal.xyz);
                TBN[2] = TBN * (rayData.normal.xyz * 2.0 - 1.0);
                TBN[1] = normalize(cross(TBN[2], TBN[0]));

                // if reflection
                if (unorm(gold_noise(C, 1.0+F)) <= (reflCoef = pow(1.f - max(dot(TBN[2], -reflDir.xyz), 0.f), 2.f) * 0.9f + 0.1)) {
                    reflDir = normalize(reflect(rayData.dir, TBN[2]));
                } else 

                // if diffuse
                if (unorm(gold_noise(C, 2.0+F)) < 1.f) {
                    const vec3 SO = lightPos.xyz + (vec4(0.f.xxx, 1.f) * modelViewInverse[0]).xyz;
                    const vec3 LC = SO - rayData.origin.xyz;
                    const float dt = dot(LC, LC);
                    const float cosL = sqrt(1.f - clamp((lightPos.w * lightPos.w) / dt, 0.f, 1.f));
                    const float weight = 2.f * (1.f - cosL);

                    //
                    reflDir = normalize(cosineWeightedPoint(TBN, C, F));
                    lightDir = coneSample(LC * inversesqrt(dt), cosL, C, F);

                    // 
                    shadowed = shadowTrace(rayData.origin.xyz + TBN[2] * epsilon, SO, lightDir);
                    const vec3 directLight = (sqrt(max(dot(TBN[2], lightDir), 0.0)) * (shadowed?0.f:1.f) + 0.0f) * rayData.diffuse.xyz;

                    //
                    fcolor += vec4(lightCol * energy.xyz * directLight, 0.f);
                    reflCol *= min(max(rayData.diffuse.xyz, 0.hf.xxx), 1.hf);
                }

                // if reflection
                energy *= vec4(max(min(reflCol, 1.f.xxx), 0.f.xxx), 1.f);
            
            // next step
            if (dot(energy.xyz, 1.f.xxx) > 0.001f && I < 1) {
                rayTrace(rayData.origin.xyz + rayData.surfaceNormal * epsilon, rayData.origin.xyz + rayData.surfaceNormal * epsilon + reflDir * 10000.f, reflDir);
            }
        } else {
            fcolor += vec4(energy.xyz * texture(nonuniformEXT(sampler2D(textures[nonuniformEXT(backgroundImageView)], samplers[nonuniformEXT(linearSampler)])), lcts(rayData.dir)).xyz, 0.f);
            break;
        }
    }

    //
    GIData data;
    data.color = vec4(fcolor.xyz/fcolor.w, 1.f);
    return data;
}
