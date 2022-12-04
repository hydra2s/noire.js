// TODO: unify with HLSL


//
vec4 divW(in vec4 v) {
    return vec4(v.xyz/v.w, 1.f);
}

//
vec4 divWn(in vec4 v) {
  return vec4(v.xyz/v.w, v.w);
}

//
vec4 divM(in vec4 v) {
  return vec4(v.xyz*v.w, v.w);
}

//
const float PI = 3.1415926535897932384626422832795028841971;
const float TWO_PI = 6.2831853071795864769252867665590057683943;
const float SQRT_OF_ONE_THIRD = 0.5773502691896257645091487805019574556476;
const float E = 2.7182818284590452353602874713526624977572;
const float INV_PI = 0.3183098861837907;
const float TWO_INV_PI = 0.6366197723675814;
const float INV_TWO_PI = 0.15915494309189535;
const float PHI = 1.61803398874989484820459; 
const float INV_SQRT_OF_2PI = 0.39894228040143267793994605993439;

//
int counter = 0;

//
float gold_noise(in vec2 xy, in float seed){
    return fract(tan(distance(xy*PHI, xy)*(seed + float(counter++)))*xy.x)*2.f-1.f;
}

//
float unorm(in float snorm) {
    return snorm * 0.5f + 0.5f;
}

// 
vec3 cosineWeightedPoint(in vec2 uv, in float F) {
    uv = vec2(unorm(gold_noise(uv, F+1.f)), unorm(gold_noise(uv, F+2.f)));
    const float radial = sqrt(uv.x);
    const float theta = TWO_PI * uv.y;
    const float x = radial * cos(theta);
    const float y = radial * sin(theta);
    return normalize(vec3(x, y, sqrt(1 - uv.x)));
};

// 
vec3 cosineWeightedPoint(in mat3x3 tbn, in vec2 uv, in float F) {
    return normalize(tbn * cosineWeightedPoint(uv, F));
};

// TODO: replace by real tangent
/*vec3 cosineWeightedDirection(in vec2 xy, float seed, vec3 normal) {
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
}*/

// TODO: replace by real tangent
void genTB(in vec3 N, out vec3 T, out vec3 B) {
    const float s = N.z < 0.0 ? -1.0 : 1.0;
    const float a = -1.0 / (s + N.z);
    const float b = N.x * N.y * a;
    T = vec3(1.0 + s * N.x * N.x * a, s * b, -s * N.x);
    B = vec3(b, s + N.y * N.y * a, -N.y);
};

// TODO: replace by real tangent
vec3 coneSample(in vec3 N, in float cosTmax, in vec2 r, in float F) {
    r = vec2(unorm(gold_noise(r, F+1.f)), unorm(gold_noise(r, F+2.f)));
    vec3 T, B; genTB(N, T, B);
    r.x *= 2.0 * PI;
    r.y = 1.0 - r.y * (1.0 - cosTmax);
    const float s = sqrt(1.0 - r.y * r.y);
    return normalize(T * (cos(r.x) * s) + B * (sin(r.x) * s) + N * r.y);
};

//
vec2 lcts(in vec3 direct) { 
  return vec2(fma(atan(direct.z,direct.x),INV_TWO_PI,0.5f), acos(direct.y)*INV_PI); 
};

//
vec3 dcts(in vec2 hr) { 
  hr = fma(hr,vec2(TWO_PI,PI), vec2(-PI,0.f));
  const float up=-cos(hr.y), over=sqrt(fma(up,-up,1.f)); 
  return vec3(cos(hr.x)*over ,up , sin(hr.x)*over); 
};

// m0 - view point of current frame
// t0 - reflection point of current frame
// p0 - plane point of current frame
// n0 - plane normal of current frame
// v0 - incident point of current frame
// thanks by criver#8473

// NEEDS MOD FOR FDNSR
vec3 proj_point_in_plane(in vec3 p, in vec3 v0, in vec3 n, inout float d) {
 d = dot(n, p - v0);
 return p - (n * d);
};

// NEEDS MOD FOR FDNSR
vec3 find_reflection_incident_point(in vec3 m0, in vec3 t0, in vec3 p0, in vec3 n0) {
  float h1=0, h2=0;
  vec3 c = proj_point_in_plane(m0, p0, n0, h1);
  vec3 d = proj_point_in_plane(t0, p0, n0, h2);

  //
  h1 = abs(h1), h2 = abs(h2);
  return mix(c,d,h1/(h1+h2));
};