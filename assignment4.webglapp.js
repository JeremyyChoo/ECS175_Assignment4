'use strict'

import Quad from './assignment4.quad.js'
import FrameBufferObject from './assignment4.fbo.js'

import * as mat4 from './js/lib/glmatrix/mat4.js'
import * as vec3 from './js/lib/glmatrix/vec3.js'
import { OrthoCamera, PerspectiveCamera } from './js/utils/camera.js'
import WebGlApp from './js/app/webglapp.js'

/**
 * @Class
 * WebGlApp that will call basic GL functions, manage a list of shapes, and take care of rendering them
 * 
 * This class will use the Shapes that you have implemented to store and render them
 */
class RenderPasses extends WebGlApp 
{
    /**
     * Initializes the app with a box, and the model, view, and projection matrices
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {Map<String,Shader>} shader The shaders to be used to draw the object
     * @param {AppState} app_state The state of the UI
     */
    constructor( gl, shaders )
    {
        super( gl, shaders )

        // Create a screen quad instance
        this.quad = new Quad( gl, this.quad_shader )

        // Create a framebuffer object
        this.fbo_pixel_filter = new FrameBufferObject(gl)
        this.fbo_directional = new FrameBufferObject(gl)
        this.fbo_point = new FrameBufferObject(gl)

        this.fbo_directional.resize( gl, 1024, 1024 )
        this.fbo_point.resize( gl, 1024, 1024 )

        this.fbo_preview = false
        this.fbo = this.fbo_pixel_filter
        this.renderShadow = false
    }

    renderpass_normal( gl, canvas_width, canvas_height, excludes = null )
    {
        this.scene.setShader(gl, this.shaders[this.active_shader])

        // Set viewport and clear canvas
        this.setViewport( gl, canvas_width, canvas_height )
        this.clearCanvas( gl )

        let shader = this.shaders[this.active_shader]

        if (this.renderShadow)
        {
            shader.use()

            shader.setUniform4x4f('u_v', this.camera.getViewMatrix())
            shader.setUniform4x4f('u_p', this.camera.getProjectionMatrix())

            shader.unuse()
        }

        this.scene.render( gl, excludes )
    }

    renderpass_pixel_filter( gl, canvas_width, canvas_height )
    {
        // TODO First rendering pass
        // ...
        this.fbo_pixel_filter.resize(gl, canvas_width, canvas_height)

        this.fbo_pixel_filter.bindFramebuffer(gl)

        this.setViewport(gl, canvas_width, canvas_height)
        this.clearCanvas(gl)

        let scale = mat4.getScaling(vec3.create(), this.scene.scenegraph.transformation)

        let shader = this.shaders[this.active_shader]

        shader.use();

        this.scene.render(gl, null)

        this.fbo_pixel_filter.unbindFramebuffer(gl)

        // TODO Second rendering pass
        // ...
        this.quad.render(gl, this.filter_mode, this.fbo.getColorTexture(), this.fbo.getDepthTexture())
        
        // render only lights
        this.scene.render( gl, [ 'model' ] )

        shader.unuse();
    }

    do_depth_pass( gl, fbo, current_light )
    {
        // compute the scale of the corrent scene
        let scale = mat4.getScaling(vec3.create(), this.scene.scenegraph.transformation)

        // TODO compute camera matrices from 
        let shadow_v
        let shadow_p
        let shadow_pv

        // TODO first rendering pass
        {
            // TODO add missing steps ...

            let shadow_camera = current_light.getCamera( scale )
            shadow_v = shadow_camera.getViewMatrix()
            shadow_p = shadow_camera.getProjectionMatrix()

            let shader = this.shaders[this.active_shader]
            {
                // TODO configure shader parameters
                shader.use()

                shadow_pv = mat4.multiply(mat4.create(), shadow_p, shadow_v)

                shader.setUniform4x4f('u_v', shadow_v)
                shader.setUniform4x4f('u_p', shadow_p)
            }

            this.renderShadow = true
            this.renderpass_normal(gl, fbo.width, fbo.height, [ 'light' ])
            this.renderShadow = false

            {
                // TODO restore shader parameters
                shader.setUniform4x4f('u_v', this.camera.getViewMatrix())
                shader.setUniform4x4f('u_p', this.camera.getProjectionMatrix())

                shader.unuse()
            }
        
            // TODO add missing steps ...
        }

        return shadow_pv// TODO compute the output projection matrix
    }

    renderpass_shadowmap( gl, canvas_width, canvas_height )
    {
        // compute the light-camera matrices for both lights
        let u_shadow_pv_directional = mat4.identity(mat4.create())
        let u_shadow_pv_point = mat4.identity(mat4.create())
        if (this.first_directional_light) {
            this.fbo_directional.bindFramebuffer(gl)
            u_shadow_pv_directional =  this.do_depth_pass( gl, this.fbo_directional, this.first_directional_light )
            this.fbo_directional.unbindFramebuffer(gl)
        }
        if (this.first_point_light) {
            this.fbo_point.bindFramebuffer(gl)
            u_shadow_pv_point = this.do_depth_pass( gl, this.fbo_point, this.first_point_light )
            this.fbo_point.unbindFramebuffer(gl)
        }

        // TODO final rendering pass
        {
            // TODO add missing steps ...  

            this.scene.setShader(gl, this.shadow_shader)
            {
                let shader = this.shadow_shader
                shader.use()

                // TODO First, restore camera position
                this.setViewport(gl, canvas_width, canvas_height)
                this.clearCanvas(gl)

                // TODO Second, pass-in light-camera matrices
                shader.setUniform4x4f('u_shadow_pv_directional', u_shadow_pv_directional)
                shader.setUniform4x4f('u_shadow_pv_point', u_shadow_pv_point)

                shader.setUniform1i('u_shadow_tex_directional', 0)
                shader.setUniform1i('u_shadow_tex_point', 1)

                // TODO Activate the depth texture for the directional light
                gl.activeTexture(gl.TEXTURE0)
                gl.bindTexture(gl.TEXTURE_2D, this.fbo_directional.getDepthTexture())

                // TODO Activate the depth texture for the point light
                gl.activeTexture(gl.TEXTURE1)
                gl.bindTexture(gl.TEXTURE_2D, this.fbo_point.getDepthTexture())

                // TODO render the scene normally without lights
                this.scene.render(gl, ['light'])

                shader.unuse()
            }

            // Finally render the annotation of lights
            if (this.first_directional_light) this.first_directional_light.render( gl )
            if (this.first_point_light) this.first_point_light.render( gl )
        }
    }
}

export default RenderPasses
