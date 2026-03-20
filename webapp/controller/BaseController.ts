import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";
import SocketService from "../model/SocketService";

/**
 * @namespace ashu.ashu.controller
 */
export default class BaseController extends Controller {
    private _intervalId: number | null = null;
    private _socketService: SocketService | null = null;

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
        this.stopRealTimeUpdates();
        this.disconnectSocket();
        window.localStorage.clear();
        MessageToast.show("Logged out successfully!");
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        router.navTo("login");
    }

    public onSignOut(): void {
        this.onLogout();
    }

    /**
     * Start automatic refresh (Real-time updates)
     * @param fnRefresh Callback function to refresh data
     * @param iInterval Interval in milliseconds (default 10s)
     */
    public startRealTimeUpdates(fnRefresh: () => void, iInterval: number = 10000): void {
        this.stopRealTimeUpdates();
        fnRefresh(); // Initial call
        this._intervalId = window.setInterval(() => {
            fnRefresh();
        }, iInterval);
        console.log("Real-time updates started with interval: " + iInterval + "ms");
    }

    /**
     * Stop automatic refresh
     */
    public stopRealTimeUpdates(): void {
        if (this._intervalId) {
            window.clearInterval(this._intervalId);
            this._intervalId = null;
            console.log("Real-time updates stopped");
        }
    }

    /**
     * Initialize WebSocket for real-time updates
     * @param sUrl WebSocket URL
     * @param fnOnMessage Callback function for received messages
     */
    public connectSocket(sUrl: string, fnOnMessage: (data: any) => void): void {
        if (!this._socketService) {
            this._socketService = new SocketService(fnOnMessage);
        }
        this._socketService.connect(sUrl);
    }

    /**
     * Close the WebSocket connection
     */
    public disconnectSocket(): void {
        if (this._socketService) {
            this._socketService.disconnect();
            this._socketService = null;
        }
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
