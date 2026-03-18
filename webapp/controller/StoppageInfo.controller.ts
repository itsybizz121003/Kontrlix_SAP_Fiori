import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";

/**
 * @namespace ashu.ashu.controller
 */
export default class StoppageInfo extends Controller {

    public onInit(): void {
        // later load stoppage info data here
    }

    public onSideItemPress(oEvent: any): void {
        const item = oEvent.getParameter("listItem") as any;
        const title = item.getTitle && item.getTitle();
        const router = (this.getOwnerComponent() as UIComponent).getRouter();

        if (title === "Monitoring-Dashboard") {
            router.navTo("dashboard");
        } else if (title === "Live Data") {
            router.navTo("liveData");
        } else if (title === "Supervisor") {
            router.navTo("supervisor");
        } else if (title === "Employees") {
            router.navTo("employees");
        } else if (title === "Machine History") {
            router.navTo("machineHistory");
        } else if (title === "Resources") {
            router.navTo("resources");
        } else if (title === "Machine Info") {
            router.navTo("machineInfo");
        } else if (title === "Stoppage Info") {
            router.navTo("stoppageInfo");
        } else if (title === "Requests") {
            router.navTo("requests");
        } else if (title === "Kontrolix-AI") {
            router.navTo("kontrolixAI");
        } else if (title === "My Profile") {
            router.navTo("myProfile");
        }
    }

    public onLogout(): void {
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        router.navTo("login");
    }

    public onSignOut(): void {
        this.onLogout();
    }
}

