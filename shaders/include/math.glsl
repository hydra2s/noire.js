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



// A single iteration of Bob Jenkins' One-At-A-Time hashing algorithm.
uint hash( uint x ) {
    x += ( x << 10u );
    x ^= ( x >>  6u );
    x += ( x <<  3u );
    x ^= ( x >> 11u );
    x += ( x << 15u );
    return x;
}



// Compound versions of the hashing algorithm I whipped together.
uint hash( uvec2 v ) { return hash( v.x ^ hash(v.y)                         ); }
uint hash( uvec3 v ) { return hash( v.x ^ hash(v.y) ^ hash(v.z)             ); }
uint hash( uvec4 v ) { return hash( v.x ^ hash(v.y) ^ hash(v.z) ^ hash(v.w) ); }



// Construct a float with half-open range [0:1] using low 23 bits.
// All zeroes yields 0.0, all ones yields the next smallest representable value below 1.0.
float floatConstruct( uint m ) {
    const uint ieeeMantissa = 0x007FFFFFu; // binary32 mantissa bitmask
    const uint ieeeOne      = 0x3F800000u; // 1.0 in IEEE binary32

    m &= ieeeMantissa;                     // Keep only mantissa bits (fractional part)
    m |= ieeeOne;                          // Add fractional part to 1.0

    return fract(uintBitsToFloat( m ));
}



// Pseudo-random value in half-open range [0:1].
float random( float x ) { return floatConstruct(hash(floatBitsToUint(x))); }
float random( vec2  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
float random( vec3  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
float random( vec4  v ) { return floatConstruct(hash(floatBitsToUint(v))); }

//
float random_seeded(in vec2 xy, in float seed) {
    return random(vec4(xy, seed, float(counter++)));
}

//
float unorm(in float snorm) {
    return snorm * 0.5f + 0.5f;
}

//
vec2 unorm(in vec2 snorm) {
    return snorm * 0.5f + 0.5f;
}

//
vec3 unorm(in vec3 snorm) {
    return snorm * 0.5f + 0.5f;
}

//
float snorm(in float snorm) {
    return snorm * 2.f - 1.f;
}

// 
void genTB(in vec3 N, out vec3 T, out vec3 B) {
    const float s = N.z < 0.0 ? -1.0 : 1.0;
    const float a = -1.0 / (s + N.z);
    const float b = N.x * N.y * a;
    T = normalize(vec3(1.0 + s * N.x * N.x * a, s * b, -s * N.x));
    B = normalize(vec3(b, s + N.y * N.y * a, -N.y));
};

vec3 randomSpherePoint(in vec2 uv, in float F) {
    const vec3 rand = vec3(random_seeded(uv, F+1.f), random_seeded(uv, F+2.f), random_seeded(uv, F+3.f));
    const float ang1 = (rand.x + 1.0) * PI; // [-1..1) -> [0..2*PI)
    const float u = rand.y; // [-1..1), cos and acos(2v-1) cancel each other out, so we arrive at [-1..1)
    const float u2 = u * u;
    const float sqrt1MinusU2 = sqrt(1.0 - u2);
    const float x = sqrt1MinusU2 * cos(ang1);
    const float y = sqrt1MinusU2 * sin(ang1);
    const float z = u;
    return normalize(vec3(x, y, z));
}

//
vec3 cosineWeightedPoint(in mat3x3 tbn, in vec2 uv, in float F) {
    const vec3 rand = vec3(random_seeded(uv, F+2.f), random_seeded(uv, F+3.f), random_seeded(uv, F+4.f));
    const float r = rand.x * 0.5 + 0.5;
    const float angle = (rand.y + 1.0) * PI;
    const float sr = sqrt(r);
    const vec2 p = vec2(sr * cos(angle), sr * sin(angle));
    const vec3 ph = vec3(p.xy, sqrt(1.0 - p*p));

    //
    tbn[0] = normalize(rand);
    tbn[1] = normalize(cross(tbn[0], tbn[2]));
    tbn[0] = normalize(cross(tbn[1], tbn[2]));
    //genTB(tbn[2], tbn[0], tbn[1]);

    //
    return normalize(tbn[0] * ph.x + tbn[1] * ph.y + tbn[2] * ph.z);
}

// 
vec3 coneSample(in vec3 N, in float cosTmax, in vec2 uv, in float F) {
      vec2 r = vec2(random_seeded(uv, F+5.f), random_seeded(uv, F+6.f));
    mat3x3 tbn = mat3x3(0.f.xxx, 0.f.xxx, N); genTB(tbn[2], tbn[0], tbn[1]);
    r.x *= 2.0 * PI;
    r.y = 1.0 - r.y * (1.0 - cosTmax);
    const float s = sqrt(1.0 - r.y * r.y);
    return normalize(tbn[0] * (cos(r.x) * s) + tbn[1] * (sin(r.x) * s) + tbn[2] * r.y);
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
}

/*
vec3 find_reflection_incident_point(vec3 p0, vec3 p1, vec3 v0, vec3 n) {
  float d0 = 0, d1 = 0;
  vec3 proj_p0 = proj_point_in_plane(p0, v0, n, d0);
  vec3 proj_p1 = proj_point_in_plane(p1, v0, n, d1);

if(d1 < d0)
   return (proj_p0 - proj_p1) * d1/(d0+d1) + proj_p1;
else
   return (proj_p1 - proj_p0) * d0/(d0+d1) + proj_p0;
}*/

//
vec3 ndc(in vec3 v3) {
    v3.xy = v3.xy * 0.5f + 0.5f;
    return v3;
}

//
vec3 undc(in vec3 v3) {
    v3.xy = v3.xy * 2.f - 1.f;
    return v3;
}

//
float fresnel(float cos_theta_incident, float cos_critical, float refractive_ratio) {
	if (cos_theta_incident <= cos_critical)
		return 1.f;

	float sin_theta_incident2 = 1.f - cos_theta_incident*cos_theta_incident;
	float t = sqrt(1.f - sin_theta_incident2 / (refractive_ratio * refractive_ratio));
	float sqrtRs = (cos_theta_incident - refractive_ratio * t) / (cos_theta_incident + refractive_ratio * t);
	float sqrtRp = (t - refractive_ratio * cos_theta_incident) / (t + refractive_ratio * cos_theta_incident);

	return mix(sqrtRs * sqrtRs, sqrtRp * sqrtRp, .5f);
}
