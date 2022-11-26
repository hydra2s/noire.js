class WindowObj {
    constructor(instanceObj) {
        this.instanceObj = instanceObj;

        //
        console.log("GLFW Window creation...");
        V.glfwWindowHint(V.GLFW_RESIZABLE, V.GLFW_FALSE);
        this.window = V.glfwCreateWindow(1280, 720, "Hello Triangle", null, null);
        this.surface = new BigUint64Array(1);
        V.glfwCreateWindowSurface(this.instanceObj.getHandle(), this.window, null, this.surface);
    }
}