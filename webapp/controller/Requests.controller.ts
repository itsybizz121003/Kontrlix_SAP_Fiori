import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ashu.ashu.controller
 */
export default class Requests extends Controller {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const requestModel = new JSONModel({
            rows: [],
            rowCount: 0,
            pendingCount: 0,
            supApprovedCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            connectionStatusText: "OFFLINE",
            connectionStatusState: "Error",
            lastUpdated: "-"
        });

        view.setModel(requestModel, "req");
        void this.loadRequests();
    }

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
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        router.navTo("login");
    }

    public onSignOut(): void {
        this.onLogout();
    }

    public onRefreshRequests(): void {
        void this.loadRequests(true);
    }

    public async onApproveRequest(oEvent: any): Promise<void> {
        const ctx = oEvent.getSource().getBindingContext("req");
        const requestId = ctx?.getProperty("RequestId") as string;
        await this.updateRequestStatus(requestId, "approved");
    }

    public async onRejectRequest(oEvent: any): Promise<void> {
        const ctx = oEvent.getSource().getBindingContext("req");
        const requestId = ctx?.getProperty("RequestId") as string;
        await this.updateRequestStatus(requestId, "rejected");
    }

    private async updateRequestStatus(requestId: string, status: string): Promise<void> {
        const token = this.getAuthToken();
        const csrfToken = await this.getCSRFToken();

        try {
            const res = await fetch(
                `/sap/opu/odata4/sap/zrequest_sb/srvd_a2x/sap/zrequest_sd/0001/Request('${requestId}')`,
                {
                    method: "PATCH",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "x-csrf-token": csrfToken
                    },
                    body: JSON.stringify({
                        AdminApprovalStatus: status,
                        AdminApprovedAt: new Date().toISOString(),
                        Status: status
                    })
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            MessageToast.show(`Request ${status} successfully!`);
            await this.loadRequests();

        } catch (e) {
            console.error("Update request failed:", e);
            MessageToast.show("Failed to update request");
        }
    }

    private async loadRequests(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("req") as JSONModel;
        const token = this.getAuthToken();

        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zrequest_sb/srvd_a2x/sap/zrequest_sd/0001/Request?$top=500&$orderby=CreatedAt desc",
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const payload = await res.json() as { value?: Array<Record<string, any>> };
            const rows = payload.value || [];

            // ── Count calculate karo Status field se ────────────────────────
            const pendingCount     = rows.filter(r => String(r.AdminApprovalStatus || "").toLowerCase() === "pending").length;
            const supApprovedCount = rows.filter(r => String(r.SupervisorApprovalStatus || "").toLowerCase() === "approved").length;
            const approvedCount    = rows.filter(r => String(r.AdminApprovalStatus || "").toLowerCase() === "approved").length;
            const rejectedCount    = rows.filter(r => String(r.AdminApprovalStatus || "").toLowerCase() === "rejected").length;

            model.setProperty("/rows",                rows);
            model.setProperty("/rowCount",            rows.length);
            model.setProperty("/pendingCount",        pendingCount);
            model.setProperty("/supApprovedCount",    supApprovedCount);
            model.setProperty("/approvedCount",       approvedCount);
            model.setProperty("/rejectedCount",       rejectedCount);
            model.setProperty("/connectionStatusText",  "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());

            if (showToast) MessageToast.show(`Loaded ${rows.length} requests`);

        } catch (e) {
            model.setProperty("/connectionStatusText",  "OFFLINE");
            model.setProperty("/connectionStatusState", "Error");
            if (showToast) MessageToast.show("Failed to load requests");
            console.error("Requests API error:", e);
        }
    }

    private getAuthToken(): string {
        return window.localStorage.getItem("machineApiToken") || "";
    }

    private async getCSRFToken(): Promise<string> {
        const token = this.getAuthToken();
        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zrequest_sb/srvd_a2x/sap/zrequest_sd/0001/Request",
                {
                    method: "GET",
                    headers: {
                        "x-csrf-token": "fetch",
                        "Authorization": `Bearer ${token}`
                    }
                }
            );
            return res.headers.get("x-csrf-token") || "";
        } catch {
            return "";
        }
    }
}