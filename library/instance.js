import { default as B } from "./basic.js";
import { default as V } from "../deps/vulkan.node.js/index.js";

//
class InstanceObj extends B.BasicObj {
    constructor(cInfo) {
        super(null, null);
        this.cInfo = cInfo;

        //
        const IExt64 = V.glfwGetRequiredInstanceExtensions();
        const IExtensionOpen = new Array(IExt64.length).fill("").map((_, i)=>{ return String.fromAddress(IExt64[i]); });

        //
        this.extensions = [].concat(IExtensionOpen);
        this.layers = ["VK_LAYER_KHRONOS_validation"];

        //
        V.vkEnumerateInstanceLayerProperties(this.amountOfLayers = new Uint32Array(1), null);
        V.vkEnumerateInstanceLayerProperties(this.amountOfLayers, this.availableLayers = new V.VkLayerProperties(this.amountOfLayers[0]));

        // 
        V.vkCreateInstance(this.pInfo = new V.VkInstanceCreateInfo({
            pNext: null,
            flags: 0,
            pApplicationInfo: this.appInfo = new V.VkApplicationInfo({
                pNext: null,
                pApplicationName: "Kratos.js",
                applicationVersion: V.VK_MAKE_API_VERSION(0, 1, 3, 234),
                pEngineName: "Kratos.js",
                engineVersion: V.VK_MAKE_API_VERSION(0, 1, 3, 234),
                apiVersion: V.VK_MAKE_API_VERSION(0, 1, 3, 234)
            }),
            enabledLayerCount: this.layers.length,
            ppEnabledLayerNames: this.layers,
            enabledExtensionCount: this.extensions.length,
            ppEnabledExtensionNames: this.extensions
        }), null, this.handle = new BigUint64Array(1));

        //
        B.Handles[this.handle[0]] = this;
    }

    //
    enumeratePhysicalDeviceObjs() {
        if (!this.devices) {
            V.vkEnumeratePhysicalDevices(this.handle[0], this.deviceCount = new Uint32Array(1), null);
            if (this.deviceCount[0] <= 0) console.error("Error: No render devices available!");
            V.vkEnumeratePhysicalDevices(this.handle[0], this.deviceCount, this._devices = new BigUint64Array(this.deviceCount[0]));
            this.devices = new Array(this.deviceCount[0]).fill({}).map((_, I)=>(new B.PhysicalDeviceObj(this.handle, this._devices[I])));
        }
        return this.devices;
    }

    // if you needs handlers only
    enumeratePhysicalDeviceHandles() {
        this.enumeratePhysicalDeviceObjs();
        return this._devices;
    }
}

//
B.InstanceObj = InstanceObj;
export default InstanceObj;
