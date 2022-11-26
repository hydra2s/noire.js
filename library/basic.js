import { default as V } from "../deps/vulkan.node.js/index.js";

//
class BasicObj {
    constructor(base, handle) {
        this.base = base;
        this.handle = handle;
    }
}

//
const Handles = {};

//
export default { Handles, BasicObj };
