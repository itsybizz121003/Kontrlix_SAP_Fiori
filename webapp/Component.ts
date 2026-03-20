import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";

/**
 * @namespace ashu.ashu
 */
export default class Component extends BaseComponent {

	public static metadata = {
		manifest: "json",
        interfaces: [
            "sap.ui.core.IAsyncContentCreation"
        ]
	};

	public init() : void {
		// call the base component's init function
		super.init();

        // set the device model
        this.setModel(createDeviceModel(), "device");

        // enable routing
        this.getRouter().initialize();

        // Check for token on startup/route change
        this.getRouter().attachRouteMatched((oEvent: any) => {
            const sRouteName = oEvent.getParameter("name");
            const sToken = window.localStorage.getItem("machineApiToken");
            
            // If token is missing and we are not on login page, redirect
            if (!sToken && sRouteName !== "login") {
                window.location.href = "http://localhost:8080/test/flp.html?sap-ui-xx-viewCache=false#app-preview";
            }
        });
	}
}