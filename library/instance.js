class InstanceObj {
    constructor() {

        //
        const IExt64 = V.glfwGetRequiredInstanceExtensions();
        const IExtensionOpen = new Array(IExt64.length).fill("").map((_, i)=>{ return String.fromAddress(IExt64[i]); });

        //
        this.appInfo = new V.VkApplicationInfo({
            pNext: null,
            pApplicationName: "NVAPI TEST",
            applicationVersion: V.VK_MAKE_API_VERSION(0, 1, 3, 234),
            pEngineName: "NVAPI",
            engineVersion: V.VK_MAKE_API_VERSION(0, 1, 3, 234),
            apiVersion: V.VK_MAKE_API_VERSION(0, 1, 3, 234)
        });

        //
        this.extensions = [].concat(IExtensionOpen);
        this.layers = ["VK_LAYER_KHRONOS_validation"];

        //
        const amountOfLayers = new Uint32Array(1);
        V.vkEnumerateInstanceLayerProperties(amountOfLayers, null);
        const availableLayers = new V.VkLayerProperties(amountOfLayers[0]);
        V.vkEnumerateInstanceLayerProperties(amountOfLayers, availableLayers);

        //
        this.pInfo = new V.VkInstanceCreateInfo({
            pNext: null,
            flags: 0,
            pApplicationInfo: this.appInfo,
            enabledLayerCount: this.layers.length,
            ppEnabledLayerNames: this.layers,
            enabledExtensionCount: this.extensions.length,
            ppEnabledExtensionNames: this.extensions
        });

        // 
        this.instance = new BigUint64Array(1);
        //const instanceU32 = instance.as("u32[2]");
        V.vkCreateInstance(this.pInfo, null, this.instance);
        //console.log(instanceU32);
    }
}