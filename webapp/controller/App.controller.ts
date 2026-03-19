import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import ToolPage from "sap/tnt/ToolPage";
import UIComponent from "sap/ui/core/UIComponent";


// hello
/**
 * @namespace ashu.ashu.controller
 */
export default class App extends Controller {
 // hey
    public onInit(): void {
        const oModel = new JSONModel({
            isLoggedIn: false,
            userInitials: "",
            selectedKey: "dashboard"
        });
        this.getView()?.setModel(oModel, "appModel");

        // Handle navigation to sync sidebar selection
        (this.getOwnerComponent() as UIComponent).getRouter().attachRouteMatched((oEvent: any) => {
            const sRouteName = oEvent.getParameter("name");
            if (sRouteName === "login") {
                oModel.setProperty("/isLoggedIn", false);
            } else {
                oModel.setProperty("/isLoggedIn", true);
                oModel.setProperty("/selectedKey", sRouteName);
                
                // Fetch initials from local storage if available
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                if (user.FirstName) {
                    oModel.setProperty("/userInitials", user.FirstName.charAt(0).toUpperCase());
                }
            }
        });
    }

    public onSideNavButtonPress(): void {
        const oToolPage = this.byId("toolPage") as ToolPage;
        oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
    }

    public onItemSelect(oEvent: any): void {
        const sKey = oEvent.getParameter("item").getKey();
        const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();
        oRouter.navTo(sKey);
    }

    public onLogout(): void {
        localStorage.removeItem("machineApiToken");
        localStorage.removeItem("appToken");
        localStorage.removeItem("user");
        (this.getOwnerComponent() as UIComponent).getRouter().navTo("login");
    }
}
