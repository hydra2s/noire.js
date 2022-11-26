import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class WindowObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null);

        //
        console.log("GLFW Window creation...");
        V.glfwWindowHint(V.GLFW_RESIZABLE, V.GLFW_FALSE);
        V.glfwCreateWindowSurface(this.base[0], this.window = V.glfwCreateWindow(1280, 720, "Kratos.js Window", null, null), null, this.surface = new BigUint64Array(1));
    }

    getSurface() {
        return this.surface[0];
    }

    getWindowSize() {
        V.glfwGetWindowSize(this.window, this.windowSize = new Uint32Array(2));
        return this.windowSize;
    }
}

B.WindowObj = WindowObj;
export default WindowObj;
