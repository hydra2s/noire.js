//
struct RayTracedData {
    f16vec4 diffuse;
    f16vec4 normal;
    f16vec4 PBR;
    f16vec4 emissive;
    f16mat3x3 TBN;
    uvec4 indices;
    uint64_t materialAddress;
    uint64_t transformAddress;
    vec2 texcoord;
    vec4 origin;
    vec3 dir;
    vec3 bary;
    float hitT;
} rayData;

// for backward compatibility
void swap(inout  vec2 a, inout  vec2 b) { const  vec2 a_ = a; a = b; b = a_; };
void swap(inout  vec3 a, inout  vec3 b) { const  vec3 a_ = a; a = b; b = a_; };
void swap(inout  vec4 a, inout  vec4 b) { const  vec4 a_ = a; a = b; b = a_; };
void swap(inout float a, inout float b) { const float a_ = a; a = b; b = a_; };

//
void rasterize(in uvec2 coord) {
    const vec3 bary = texelFetch(FBOF[framebuffers[_BARY]], ivec3(coord, 0), 0).xyz;
    const uvec4 sys = texelFetch(FBOU[framebuffers[_INDICES]], ivec3(coord, 0), 0);

    //
    rayData.texcoord = texelFetch(FBOF[framebuffers[_TEXCOORD]], ivec3(coord, 0), 0).xy;
    rayData.hitT = 0.f;
    rayData.normal = f16vec4(imageLoad(_TBNDATA, ivec2(coord), 0));
    rayData.bary = bary;
    rayData.TBN = f16mat3x3(
        imageLoad(_TBNDATA, ivec2(coord), 2),
        imageLoad(_TBNDATA, ivec2(coord), 3),
        imageLoad(_TBNDATA, ivec2(coord), 4)
    );

    //
    vec4 pos = divW(texelFetch(FBOF[framebuffers[_POSITION]], ivec3(coord, 0), 0));
    vec4 _camera = divW(pos * inverse(perspective));
    vec4 _origin = (_camera * modelViewInverse[0]);

    //
    rayData.dir = normalize((modelView[0] * vec4(normalize(_camera.xyz), 0.f)).xyz);
    rayData.origin = _origin;

    //
    nrNode nodeData = nrNode(nodeBuffer) + sys.x;
    nrMesh meshData = nrMesh(nodeData.meshBuffer);
    nrGeometry geometryData = nrGeometry(meshData.address) + sys.y;

    //
    rayData.materialAddress = geometryData.materialAddress;
    rayData.diffuse = f16vec4(imageLoad(_DIFFUSE, ivec2(coord), 0));
    rayData.PBR     = f16vec4(imageLoad(_METAPBR, ivec2(coord), 0));
}

//
void rayTrace(in vec3 origin, in vec3 far, in vec3 dir) {
    rayData.normal = f16vec4(0.f, 0.f, 0.5f, 0.f);
    rayData.diffuse = f16vec4(0.f.xxx, 1.f);
    rayData.origin = vec4(far, 1.f);
    rayData.dir = dir;
    rayData.bary = vec3(0.f.xxx);
    rayData.hitT = 0.f;

    //
    vec3 NOR = normalize((modelView[0] * vec4(0.f, 0.f, 0.5f, 0.f)).xyz);

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
        vec4 vertex = readFloatData3(geometryData.vertex, indices) * bary;
        vec4 _origin = vec4(vertex.xyz, 1.f) * nodeData.transform; //vec4(rayQueryGetIntersectionObjectToWorldEXT(rayQuery, true) * vec4(rayQueryGetIntersectionObjectRayOriginEXT(rayQuery, true), 1.f), rayQueryGetIntersectionTEXT(rayQuery, true));
        rayData.origin = _origin;
        rayData.bary = bary;
        rayData.hitT = rayQueryGetIntersectionTEXT(rayQuery, true);

        //
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        // Hosico
        vec3 NOR = normalize((readFloatData3(geometryData.normal, indices) * bary).xyz);
        NOR = normalize((nodeData.transformInverse * vec4(NOR.xyz, 0.0f)).xyz);
        NOR = faceforward(NOR, rayData.dir, NOR);

        // TOO PISSFUL for FPS
        vec4 TAN = readFloatData3(geometryData.tangent, indices) * bary;
        TAN.xyz = normalize(TAN.xyz);
        TAN.xyz = normalize((nodeData.transformInverse * vec4(TAN.xyz, 0.f)).xyz) * TAN.w;
        TAN.xyz = normalize(TAN.xyz - dot(TAN.xyz, NOR) * NOR);

        //
        const vec3 BIN = normalize(cross(TAN.xyz, NOR));

        //
        rayData.transformAddress = uint64_t(nodeData);
        rayData.emissive = readTexData(materialData.emissive, texcoord.xy);
        rayData.diffuse = readTexData(materialData.diffuse, texcoord.xy);
        rayData.normal = readTexData(materialData.normal, texcoord.xy);;
        rayData.PBR = readTexData(materialData.PBR, texcoord.xy);
        rayData.diffuse.xyz = pow(rayData.diffuse.xyz, 2.2hf.xxx);

        // 
        rayData.TBN = f16mat3x3(TAN.xyz, BIN.xyz, NOR.xyz);
        rayData.normal.xyz = rayData.TBN * rayData.normal.xyz;
    }
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
    f16vec4 color;
    float nearT;
};

//
GIData globalIllumination() {
    const vec4 lightPos = vec4(0, 100, 10, 1);
    vec3 lightDir = normalize(lightPos.xyz - rayData.origin.xyz);
    vec3 lightCol = 4.f.xxx;
    float diff = sqrt(max(dot(vec3(rayData.normal.xyz), lightDir), 0.0));

    //
    const float epsilon = 0.001f * pow(texelFetch(FBOF[framebuffers[_POSITION]], ivec3(gl_GlobalInvocationID.xy, 0), 0).z, 256.f);
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

    //
    uvec4 indices = uvec4(unpack32(rayData.transformAddress), 0u, 0u);
    float roughness = 1.f;
    float nearT = 0.f;
    bool hasHit = false;

    //
    if (hasHit = any(greaterThan(rayData.bary, 0.0001f.xxx))) {
        for (int I=0;I<2;I++) {
            if ((hasHit = any(greaterThan(rayData.bary, 0.0001f.xxx))) && dot(energy.xyz, 1.f.xxx) > 0.001f) {
                // shading
                    if (reflCoef * (1.f - float(rayData.PBR.g)) > 0.9) { nearT += rayData.hitT; indices = uvec4(unpack32(rayData.transformAddress), 0u, 0u); };
                    lightDir = normalize(lightPos.xyz - rayData.origin.xyz);
                    reflCol = 1.f.xxx;

                    //
                    f16mat3x3 TBN = f16mat3x3(rayData.TBN[0], rayData.TBN[1], rayData.normal.xyz);

                    // if reflection
                    if (unorm(gold_noise(C, 1.0+F)) <= (reflCoef = mix(pow(1.f - max(dot(vec3(TBN[2]), -reflDir.xyz), 0.f), 2.f) * 1.f, 1.f, float(rayData.PBR.b)))) {
                        reflDir = normalize(mix(normalize(reflect(rayData.dir, vec3(TBN[2]))), normalize(cosineWeightedPoint(TBN, C, F)), float(rayData.PBR.g)));
                        if (I == 0) roughness = max(float(rayData.PBR.g), 0.0002f);
                        //reflCol *= min(max(mix(1.hf.xxx, rayData.diffuse.xyz, rayData.PBR.b), 0.hf), 1.hf);
                        
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
                        if (I == 0) roughness = 1.f;

                        // 
                        shadowed = shadowTrace(rayData.origin.xyz + TBN[2] * epsilon, SO, lightDir);
                        const vec3 directLight = (sqrt(max(dot(vec3(TBN[2]), lightDir), 0.0)) * (shadowed?0.f:1.f) + 0.0f) * rayData.diffuse.xyz;

                        //
                        fcolor += vec4(lightCol * energy.xyz * directLight, 0.f);
                        reflCol *= min(max(rayData.diffuse.xyz, 0.hf.xxx), 1.hf);
                    }

                    // if reflection
                    energy *= vec4(max(min(reflCol, 1.f.xxx), 0.f.xxx), 1.f);
                // next step
                if (dot(energy.xyz, 1.f.xxx) > 0.001f && I < 1) {
                    rayTrace(rayData.origin.xyz + rayData.TBN[2] * epsilon, rayData.origin.xyz + rayData.TBN[2] * epsilon + reflDir * 10000.f, reflDir);
                }
            } else {
                //nearT = 10000.f;
                fcolor += vec4(energy.xyz * texture(nonuniformEXT(sampler2D(textures[nonuniformEXT(backgroundImageView)], samplers[nonuniformEXT(linearSampler)])), lcts(rayData.dir)).xyz, 0.f);
                break;
            }
        }
    } else {
        fcolor = vec4(rayData.diffuse.xyz, 1.f);
    }

    //
    GIData data;
    data.color = f16vec4(fcolor.xyz/fcolor.w, 1.f);
    data.nearT = nearT;
    return data;
}
