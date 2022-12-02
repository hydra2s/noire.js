import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class WindowObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null);

        //
        console.log("GLFW Window creation...");
        V.glfwWindowHint(V.GLFW_RESIZABLE, V.GLFW_FALSE);
        V.glfwCreateWindowSurface(this.base[0], this.window = V.glfwCreateWindow(cInfo.width, cInfo.height, "Noire.js Window", null, null), null, this.surface = new BigUint64Array(1));
        //this.handle = new BigUint64Array([this.window]); // TODO: native pointers of GLFW window
    }

    getDPI() {
        V.glfwGetWindowContentScale(this.window, this.DPI = new Float32Array(2));
        return this.DPI;
    }

    getSurface() {
        return this.surface[0];
    }

    getWindowSize() {
        V.glfwGetWindowSize(this.window, this.windowSize = new Uint32Array(2));
        return this.windowSize;
    }

    getWindow() {
        return this.window;
    }
}

//
B.WindowObj = WindowObj;
export default WindowObj;
