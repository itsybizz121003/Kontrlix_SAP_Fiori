import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";

/**
 * @namespace ashu.ashu.controller
 */
export default class BaseController extends Controller {

    public onSideItemPress(oEvent: any): void {
        const item = oEvent.getParameter("listItem") as any;
        const title = item.getTitle && item.getTitle();
        const router = (this.getOwnerComponent() as UIComponent).getRouter();

        if (title === "Monitoring-Dashboard") router.navTo("dashboard");
        else if (title === "Live Data") router.navTo("liveData");
        else if (title === "Supervisor") router.navTo("supervisor");
        else if (title === "Employees") router.navTo("employees");
        else if (title === "Machine History") router.navTo("machineHistory");
        else if (title === "Resources") router.navTo("resources");
        else if (title === "Machine Info") router.navTo("machineInfo");
        else if (title === "Stoppage Info") router.navTo("stoppageInfo");
        else if (title === "Requests") router.navTo("requests");
        else if (title === "Kontrolix-AI") router.navTo("kontrolixAI");
        else if (title === "My Profile") router.navTo("myProfile");
    }

    public onLogout(): void {
        window.localStorage.removeItem("machineApiToken");
        window.localStorage.removeItem("appToken");
        window.localStorage.removeItem("user");
        MessageToast.show("Logged out successfully!");
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        router.navTo("login");
    }

    public onSignOut(): void {
        this.onLogout();
    }

    public getAuthToken(): string {
        return window.localStorage.getItem("machineApiToken") || "";
    }

    public getAssignedResources(): Array<any> {
        try {
            const resources = window.localStorage.getItem("assignedResources");
            return resources ? JSON.parse(resources) : [];
        } catch {
            return [];
        }
    }

    public getAssignedEmployees(): Array<any> {
        try {
            const employees = window.localStorage.getItem("assignedEmployees");
            return employees ? JSON.parse(employees) : [];
        } catch {
            return [];
        }
    }

    public async getCSRFToken(isSupervisor = false): Promise<string> {
        const token = this.getAuthToken();
        try {
            const url = isSupervisor
                ? "/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Supervisor"
                : "/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User";

            const res = await fetch(url, {
                method: "GET",
                headers: {
                    "x-csrf-token": "fetch",
                    "Authorization": `Bearer ${token}`
                }
            });
            return res.headers.get("x-csrf-token") || "";
        } catch {
            return "";
        }
    }
}
