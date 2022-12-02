
//
vec4 divW(in vec4 v) {
    return vec4(v.xyz/v.w, 1.f);
}

const float PHI = 1.61803398874989484820459;  // Φ = Golden Ratio   
const float PI = 3.14159265359;

//
float gold_noise(in vec2 xy, in float seed){
    return fract(tan(distance(xy*PHI, xy)*seed)*xy.x)*2.f-1.f;
}

//
float unorm(in float snorm) {
    return snorm * 0.5f + 0.5f;
}

//
vec3 cosineWeightedDirection(in vec2 xy, float seed, vec3 normal) {
   float u = unorm(gold_noise(xy, seed + 1.f));
   float v = unorm(gold_noise(xy, seed + 2.f));
   float r = sqrt(u);
   float angle = 6.283185307179586 * v;
    // compute basis from normal
   vec3 sdir, tdir;
   if (abs(normal.x)<.5) {
     sdir = cross(normal, vec3(1,0,0));
   } else {
     sdir = cross(normal, vec3(0,1,0));
   }
   tdir = cross(normal, sdir);
   return r*cos(angle)*sdir + r*sin(angle)*tdir + sqrt(1.-u)*normal;
}