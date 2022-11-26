import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class FramebufferLayoutObj extends B.BasicObj {
    constructor(base, cInfo) {
        super(base, null); this.cInfo = cInfo;

    }
}

//
B.FramebufferLayoutObj = FramebufferLayoutObj;

//
export default FramebufferLayoutObj;
