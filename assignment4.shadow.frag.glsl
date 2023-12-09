#version 300 es

#define MAX_LIGHTS 16

// Fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision".
precision mediump float;

// struct definitions
struct AmbientLight {
    vec3 color;
    float intensity;
};

struct DirectionalLight {
    vec3 direction;
    vec3 color;
    float intensity;
};

struct PointLight {
    vec3 position;
    vec3 color;
    float intensity;
};

struct Material {
    vec3 kA;
    vec3 kD;
    vec3 kS;
    float shininess;
};

// flags
uniform bool u_show_normals;

// lights
uniform AmbientLight u_lights_ambient[MAX_LIGHTS];
uniform DirectionalLight u_lights_directional[MAX_LIGHTS];
uniform PointLight u_lights_point[MAX_LIGHTS];

// materials
uniform Material u_material;

// camera position
uniform vec3 u_eye;

// depth maps
uniform sampler2D u_shadow_tex_directional;
uniform sampler2D u_shadow_tex_point;

// received from vertex stage
in vec3 o_vertex_normal_world;
in vec3 o_vertex_position_world;
in vec4 o_shadow_coord_directional;
in vec4 o_shadow_coord_point;

// with webgl 2, we now have to define an out that will be the color of the fragment
out vec4 o_fragColor;


// Shades an ambient light and returns this light's contribution
vec3 shadeAmbientLight(Material material, AmbientLight light) {
    if (light.intensity == 0.0) return vec3(0);

    return light.color * light.intensity * material.kA;
}

// Shades a directional light and returns its contribution
vec3 shadeDirectionalLight(Material material, DirectionalLight light, vec3 normal, vec3 eye, vec3 vertex_position) {
    vec3 result = vec3(0);
    if (light.intensity == 0.0) return result;

    vec3 N = normalize(normal);
    vec3 L = -normalize(light.direction);
    vec3 V = normalize(vertex_position - eye);

    // Diffuse
    float LN = max(dot(L, N), 0.0);
    result += LN * light.color * light.intensity * material.kD;

    // Specular
    vec3 R = reflect(L, N);
    result += pow( max(dot(R, V), 0.0), material.shininess) * light.color * light.intensity * material.kS;

    return result;
}

// Shades a point light and returns its contribution
vec3 shadePointLight(Material material, PointLight light, vec3 normal, vec3 eye, vec3 vertex_position) {
    vec3 result = vec3(0);
    if (light.intensity == 0.0) return result;

    vec3 N = normalize(normal);
    float D = distance(light.position, vertex_position);
    vec3 L = normalize(light.position - vertex_position);
    vec3 V = normalize(vertex_position - eye);

    // Diffuse
    float LN = max(dot(L, N), 0.0);
    result += LN * light.color * light.intensity * material.kD;

    // Specular
    vec3 R = reflect(L, N);
    result += pow( max(dot(R, V), 0.0), material.shininess) * light.color * light.intensity * material.kS;

    // Attenuation
    result *= 1.0 / (D*D+1.0);

    return result;
}

float computeVisibility(vec4 shadow_coord, sampler2D shadow_tex)
{
    const float bias = 0.0005; // constant bias

    // TODO compute visibility
    // perform perspective divide
    vec3 projCoords = shadow_coord.xyz / shadow_coord.w;

    // transform to [0,1] range
    projCoords = projCoords * 0.5 + 0.5;

    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    float closestDepth = texture(shadow_tex, projCoords.xy).r; 

    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;

    // check whether current frag pos is in shadow
    // float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;
    // PCF
    float shadow = 0.0;
    vec2 texelSize = vec2(1.0) / vec2(textureSize(shadow_tex, 0));
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadow_tex, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;        
        }    
    }
    shadow /= 9.0;
    
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if(projCoords.z > 1.0)
        shadow = 0.0;
        
    return 1.0 - shadow;
}

void main() {

    // If we want to visualize only the normals, no further computations are needed
    if (u_show_normals) {
        o_fragColor = vec4(o_vertex_normal_world * 0.5 + 0.5, 1.0);
        return;
    }

    // we start at 0.0 contribution for this vertex
    vec3 light_contribution = vec3(0.0);

    // iterate over all possible lights and add their contribution
    for(int i = 0; i < MAX_LIGHTS; i++) {
        light_contribution += shadeAmbientLight(u_material, u_lights_ambient[i]);
    }

    // only render the first directional light
    light_contribution += computeVisibility(o_shadow_coord_directional, u_shadow_tex_directional)
        * shadeDirectionalLight(u_material, u_lights_directional[0], o_vertex_normal_world, u_eye, o_vertex_position_world);

    // only render the first point light
    light_contribution += computeVisibility(o_shadow_coord_point, u_shadow_tex_point)
        * shadePointLight(u_material, u_lights_point[0], o_vertex_normal_world, u_eye, o_vertex_position_world);

    o_fragColor = vec4(light_contribution, 1.0);
    // o_fragColor = texture(shadow_tex, );

    vec2 uv = gl_FragCoord.xy / vec2(1412.0, 794.0);
    // o_fragColor = texture(u_shadow_tex_directional, uv);
    // o_fragColor = vec4(uv, 0.0, 1.0);
}
