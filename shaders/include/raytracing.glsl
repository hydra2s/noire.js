//
struct RayTracedData {
    min16float4 diffuse;
    min16float4 normal;
    min16float4 PBR;
    min16float4 emissive;
    min16float4 transmission;
    mat3x3 TBN;
    uvec4 indices;
    uint64_t materialAddress;
    uint64_t transformAddress;
    vec2 texcoord;
    vec4 origin;
    vec3 dir;
    vec3 bary;
    float hitT;
    int source;
};

// for backward compatibility
void swap(inout  vec2 a, inout  vec2 b) { const  vec2 a_ = a; a = b; b = a_; };
void swap(inout  vec3 a, inout  vec3 b) { const  vec3 a_ = a; a = b; b = a_; };
void swap(inout  vec4 a, inout  vec4 b) { const  vec4 a_ = a; a = b; b = a_; };
void swap(inout float a, inout float b) { const float a_ = a; a = b; b = a_; };

//
float raySphereIntersect(vec3 origin, vec3 ray, vec4 sphere) {
    vec3 toSphere = origin - sphere.xyz;
    float a = dot(ray, ray);
    float b = 2.0 * dot(toSphere, ray);
    float c = dot(toSphere, toSphere) - sphere.w*sphere.w;
    float discriminant = b*b - 4.0*a*c;
    if(discriminant > 0.0) {
        float t = (-b - sqrt(discriminant)) / (2.0 * a);
        if(t > 0.0) return t;
    }
    return 10000.f;
}

//
RayTracedData rasterize(in uvec2 coord) {
    const vec3 bary = framebufferLoadF(_BARY, ivec2(coord), 0).xyz;
    const uvec4 sys = framebufferLoadU(_INDICES, ivec2(coord), 0);

    //
    RayTracedData rayData;
    rayData.materialAddress = uint64_t(0u);
    rayData.transformAddress = uint64_t(0u);
    rayData.bary = framebufferLoadF(_BARY, ivec2(coord), 0).xyz;
    rayData.indices = framebufferLoadU(_INDICES, ivec2(coord), 0);
    rayData.texcoord = framebufferLoadF(_TEXCOORD, ivec2(coord), 0).xy;
    rayData.hitT = 0.f;
    rayData.normal = min16float4(imageSetLoadF(_PRECISE, ivec2(coord), 1));
    rayData.bary = bary;
    rayData.TBN = mat3x3(
        normalize(imageSetLoadF(_DOTHERS, ivec2(coord), 3)),
        normalize(imageSetLoadF(_DOTHERS, ivec2(coord), 4)),
        normalize(imageSetLoadF(_DOTHERS, ivec2(coord), 5))
    );

    //
    vec4 _origin = imageSetLoadF(_PRECISE, ivec2(coord), 0);
    vec4 _camera = _origin * modelView[0];

    //
    rayData.dir = normalize((modelView[0] * vec4(normalize(_camera.xyz), 0.f)).xyz);
    rayData.origin = _origin;

    //
    nrNode nodeData = nrNode(nodeBuffer) + sys.x;
    nrMesh meshData = nrMesh(nodeData.meshBuffer);
    nrGeometry geometryData = nrGeometry(meshData.address) + sys.y;

    //
    rayData.materialAddress = geometryData.materialAddress;
    rayData.diffuse      = min16float4(imageSetLoadF(_DOTHERS, ivec2(coord), 0));
    rayData.emissive     = min16float4(imageSetLoadF(_DOTHERS, ivec2(coord), 1));
    rayData.transmission = min16float4(imageSetLoadF(_DOTHERS, ivec2(coord), 2));
    rayData.PBR          = min16float4(imageSetLoadF(_METAPBR, ivec2(coord), 3));
    //rayData.diffuse.xyz = max(rayData.diffuse.xyz + rayData.emissive.xyz, 0.f.xxx);

    //
    return rayData;
}

// 
const vec4 lightPos[1] = { vec4(5, 100, 5, 10) };
const vec3 lightCol[1] = { vec3(4.f.xxx * 200.f) };
const float epsilon = 0.001f;

// 
RayTracedData getData(in vec3 origin, in vec3 dir, in uvec4 sys, in vec3 bary, in float T, in int source) {
    RayTracedData rayData;
    rayData.dir = dir;
    rayData.origin = vec4(origin.xyz, 1.f);
    rayData.bary = bary;
    rayData.hitT = T;
    rayData.indices = sys;
    rayData.texcoord = vec2(0.f);
    rayData.materialAddress = uint64_t(0u);
    rayData.transformAddress = uint64_t(0u);
    rayData.PBR = vec4(0.f.xxxx);
    rayData.transmission = f16vec4(0.f, 1.f, 1.f, 1.f);

    //
    const vec4 env = texture(nonuniformEXT(sampler2D(textures[nonuniformEXT(backgroundImageView)], samplers[nonuniformEXT(linearSampler)])), lcts(dir));

    //
    rayData.diffuse = vec4(1.f.xxx, 1.f);
    rayData.emissive = env;

    //
    vec3 NOR = normalize((modelView[0] * vec4(0.f, 0.f, 0.5f, 0.f)).xyz);
    rayData.normal = min16float4(NOR.xyz, 0.f);
    rayData.TBN = mat3x3(
        min16float3(0.f.xxx),
        min16float3(0.f.xxx),
        rayData.normal.xyz
    );

    //
    if (source == -1 && any(greaterThan(rayData.bary, 0.00001f.xxx))) {
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
        rayData.hitT = T;

        //
        rayData.texcoord = texcoord.xy;
        rayData.materialAddress = geometryData.materialAddress;
        rayData.indices = sys;

        //
        rayData.transformAddress = uint64_t(nodeData);
        rayData.emissive = readTexData(materialData.emissive, texcoord.xy);
        rayData.diffuse = readTexData(materialData.diffuse, texcoord.xy);
        rayData.normal = readTexData(materialData.normal, texcoord.xy);
        rayData.PBR = readTexData(materialData.PBR, texcoord.xy);
        rayData.transmission = readTexData(materialData.transmission, texcoord.xy);
        rayData.diffuse.xyz = pow(rayData.diffuse.xyz, 2.2f.xxx);
        rayData.emissive.xyz = pow(rayData.emissive.xyz, 2.2f.xxx);

        // 
        vec3 NOR = normalize((readFloatData3(geometryData.normal, indices) * bary).xyz);
        NOR = normalize((nodeData.transformInverse * vec4(NOR.xyz, 0.0f)).xyz);

        // broken transmission IOR
        if (rayData.transmission.g < 1.f) { rayData.transmission.g = 1.f; };

        //
        bool backface = false;
        if (dot(NOR, rayData.dir) >= 0.f) {
            rayData.transmission.g = 1.f / rayData.transmission.g; backface = true;
        };

        //
        NOR = normalize(faceforward(NOR, rayData.dir, NOR));

        // 
        vec4 TAN = readFloatData3(geometryData.tangent, indices) * bary;
        vec3 BIN = vec3(0.f.xxx);
        if (abs(TAN.w) > 0.001f && dot(TAN.xyz, TAN.xyz) > 0.001f) {
            TAN.xyz = normalize((nodeData.transformInverse * vec4(normalize(TAN.xyz), 0.f)).xyz) * TAN.w;
            TAN.xyz = normalize(TAN.xyz - dot(TAN.xyz, NOR) * NOR);

            //
            BIN = normalize(cross(TAN.xyz, NOR));
            BIN = BIN - NOR * dot(BIN, NOR);
            BIN = normalize(BIN - TAN.xyz * dot(BIN, TAN.xyz));
        } else {
            // if TBN is broken!
            genTB(NOR.xyz, TAN.xyz, BIN.xyz); TAN.w = 1.f;
        }

        // 
        rayData.TBN = mat3x3(TAN.xyz, BIN.xyz, NOR.xyz);
        rayData.normal.xyz = normalize(rayData.TBN * (rayData.normal.xyz * 2.f - 1.f));
        rayData.normal.xyz = faceforward(rayData.normal.xyz, min16float3(rayData.dir.xyz), rayData.normal.xyz);

        //
        rayData.PBR.r = mix(backface ? 0.f : fresnel(max(dot(vec3(rayData.normal.xyz), -rayData.dir.xyz), 0.f), 0.1f, max(rayData.transmission.g, 1.2f)), 1.f, float(rayData.PBR.b));
        rayData.PBR.r *= (1.f - float(rayData.PBR.g));

        // emitent can't to be transmissive
        if (dot(rayData.emissive.xyz, 1.f.xxx) > 0.1f) { rayData.transmission.r = 0.f; };

        // debug reflection
        //rayData.PBR.g = 0.f;
        //rayData.normal.xyz = rayData.TBN[2];

        //
        rayData.PBR.xyz = max(rayData.PBR.xyz, 0.01f);
        rayData.PBR.r *= rayData.diffuse.a;
    } else 
    // TODO: more light source support
    if (source >= 0) {
        //
        rayData.origin.xyz = rayData.origin.xyz + rayData.dir.xyz * rayData.hitT;
        rayData.emissive = vec4(lightCol[source], 1.f);
        rayData.PBR.g = 1.f;
        rayData.PBR.b = 1.f;
        rayData.PBR.r = 0.f;
    }

    //
    return rayData;
}

// 
RayTracedData rayTrace(in vec3 origin, in vec3 dir) {
    RayTracedData rayData;
    rayData.origin = vec4(origin.xyz, 0.f);
    rayData.dir = dir;
    rayData.hitT = raySphereIntersect(origin, dir, lightPos[0]);
    rayData.bary = vec3(0.f);
    rayData.source = -1;

    //
    rayQueryEXT rayQuery;
    rayQueryInitializeEXT(rayQuery, accelerationStructureEXT(accStruct), /*gl_RayFlagsCullBackFacingTrianglesEXT*/0, 0xFF, origin, 0.01f, dir, rayData.hitT);

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
        rayData.bary = max(vec3(1.f - bary_.x - bary_.y, bary_.xy), 0.00002f.xxx);
        rayData.indices = uvec4(rayQueryGetIntersectionInstanceIdEXT(rayQuery, true), rayQueryGetIntersectionGeometryIndexEXT(rayQuery, true), rayQueryGetIntersectionPrimitiveIndexEXT(rayQuery, true), 0u);
        rayData.hitT = rayQueryGetIntersectionTEXT(rayQuery, true);
    } else // TODO: more light sources support
    if (rayData.hitT < 10000.f) {
        rayData.source = 0;    
    }

    //
    rayData = getData(origin, dir, rayData.indices, rayData.bary, rayData.hitT, rayData.source);

    //
    return rayData;
}

//
bool shadowTrace(in vec3 origin, in float dist, in vec3 dir) {
    rayQueryEXT rayQuery;

    // 
    rayQueryInitializeEXT(rayQuery, accelerationStructureEXT(accStruct), /*gl_RayFlagsCullBackFacingTrianglesEXT |*/ gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, origin, 0.01f, dir, dist);

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
        if (random_seeded(vec2(gl_GlobalInvocationID.xy), 3.0+frameCount) < transparency && T <= dist) {
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
    min16float4 color;
    float nearT;
    uint type;
};

//
GIData globalIllumination(in RayTracedData rayData) {
    vec4 fcolor = vec4(0.f.xxx, 1.f);
    vec4 energy = vec4(1.f.xxx, 1.f);
    vec3 reflDir = normalize(rayData.dir);

    //
    vec2 C = vec2(gl_GlobalInvocationID.xy);
    float F = frameCount;

    //
    uvec4 indices = uvec4(unpack32(rayData.transformAddress), 0u, 0u);
    float roughness = rayData.PBR.g;
    float nearT = 0.f;
    bool hasHit = false;

    //
    uint type = 0;

    //
    //int REFL_RIGHT = 0;
    float reflCoef = rayData.PBR.r, transpCoef = 1.f - rayData.diffuse.a;
    int ITERATION_COUNT = 2, R = 3;
    if (hasHit = any(greaterThan(rayData.bary, 0.00001f.xxx))) {
        for (int I=0;I<ITERATION_COUNT;I++) {
            if ((hasHit = any(greaterThan(rayData.bary, 0.00001f.xxx))) && dot(energy.xyz, 1.f.xxx) > 0.001f) {
                // shading
                mat3x3 TBN = mat3x3(rayData.TBN[0], rayData.TBN[1], rayData.normal.xyz);
                genTB(TBN[2], TBN[0], TBN[1]);
                //TBN[1] = (cross(TBN[0], TBN[2]));
                //TBN[0] = (cross(TBN[1], TBN[2]));

                // TODO: push first rays depence on pixel and frametime
                int rtype = 0;
                if (random_seeded(C, 6.0+F) <= rayData.PBR.r) { rtype = 1; } else 
                if (random_seeded(C, 7.0+F) <= mix(1.f, rayData.transmission.x, rayData.diffuse.a)) { rtype = 2; }
                if (I == 0) { type = rtype; }

                // if reflection
                if (rtype == 1) {
                    reflDir = normalize(mix(normalize(reflect(rayData.dir, vec3(TBN[2]))), normalize(cosineWeightedPoint(TBN, C, F+8.0)), float(rayData.PBR.g) * random_seeded(C, 2.0+F)));
                    energy.xyz *= min(mix(min16float3(1.f.xxx), max(rayData.diffuse.xyz, min16float3(0.f.xxx)), rayData.PBR.b), min16float(1.f));

                    //
                    if (reflCoef > 0.8 || I == 1) { nearT += rayData.hitT; indices = uvec4(unpack32(rayData.transformAddress), 0u, 0u); if (I == 0 && R > 0) { ITERATION_COUNT += 1; R--; } };
                } else 

                if (rtype == 2) {
                    // TODO: volume support
                    if (transpCoef > 0.8 || I == 1) { nearT += rayData.hitT; indices = uvec4(unpack32(rayData.transformAddress), 0u, 0u); };
                    reflDir = normalize(mix(refract(rayData.dir, vec3(TBN[2]), 1.f / rayData.transmission.g), -normalize(cosineWeightedPoint(TBN, C, F+8.0)), float(rayData.PBR.g) * rayData.diffuse.a * random_seeded(C, 2.0+F)));
                    energy.xyz *= mix(1.f.xxx, rayData.diffuse.xyz, rayData.diffuse.a); // transmission is broken with alpha channels
                    if (R > 0) { ITERATION_COUNT += 1; R--; }
                } else

                // if diffuse
                /*if (rtype == 0)*/
                {
                    const vec3 SO = lightPos[0].xyz;
                    const vec3 SS = lightPos[0].w * randomSpherePoint(C, F) + SO;
                    const vec3 LC = SO - rayData.origin.xyz;
                    const vec3 LS = SS - rayData.origin.xyz;
                    const float dt = dot(LC, LC);
                    const float cosL = sqrt(1.f - clamp((lightPos[0].w * lightPos[0].w) / dt, 0.f, 1.f));
                    const float weight = 2.f * (1.f - cosL);

                    //
                    reflDir = normalize(cosineWeightedPoint(TBN, C, F));
                    const vec3 lightDir = normalize(LS);

                    // direct light isn't support transmission, and has only basic alpha channel support
                    // support such features too expensive for shadows
                    // also, direct light doesn't support refraction
                    const bool shadowed = shadowTrace(rayData.origin.xyz + rayData.TBN[2] * epsilon, length(LS), lightDir);
                    const vec3 directLight = weight * (sqrt(max(dot(TBN[2], lightDir), 0.0)) * (shadowed?0.f:1.f) + 0.0f).xxx;

                    //
                    min16float3 diffCol = (I == 0 ? 1.f.xxx : rayData.diffuse.xyz);
                    if (dot(rayData.emissive.xyz, 1.f.xxx) > 0.1f) { 
                        fcolor += vec4(energy.xyz * (I == 0 ? 0.f.xxx : rayData.emissive.xyz) /*/ max(I == 0 ? rayData.diffuse.xyz : 1.f.xxx, 0.0001f.xxx)*/, 0.f);
                    } else {
                        fcolor += vec4(energy.xyz * lightCol[0] * directLight * diffCol, 0.f);
                    }
                    energy.xyz *= diffCol;
                }

                //
                reflCoef = rayData.PBR.r, transpCoef = 1.f - rayData.diffuse.a;

                // next step
                if (dot(energy.xyz, 1.f.xxx) > 0.001f && I<(ITERATION_COUNT-1)) {
                    RayTracedData _rayData = rayTrace(rayData.origin.xyz + rayData.TBN[2] * epsilon * sign(dot(rayData.TBN[2], reflDir)), reflDir);
                    rayData = _rayData;
                }
            } else {
                fcolor += vec4(energy.xyz * rayData.emissive.xyz, 0.f);
                energy.xyz *= 0.f.xxx;
                if (I == 1) { nearT = 10000.0f; };
                break;
            }
        }
    } else {
        fcolor = vec4(rayData.emissive.xyz, 1.f);
        energy.xyz *= 0.f.xxx;
    }

    //
    GIData data;
    data.color = min16float4(fcolor.xyz/fcolor.w, 1.f);
    data.nearT = nearT;
    data.type = type;
    return data;
}
