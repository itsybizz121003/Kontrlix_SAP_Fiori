import Controller from "./BaseController";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ashu.ashu.controller
 */
export default class StoppageInfo extends Controller {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const stoppageModel = new JSONModel({
            runTime: "0m",
            idealTime: "0m",
            stopTime: "0m",
            stoppageRows: [],
            stoppageTotalCount: 0,
            selectedTime: "allTime",
            selectedMachine: "allMachines"
        });

        view.setModel(stoppageModel, "stoppage");
        void this.loadStoppageData();
    }

    public onRefresh(): void {
        void this.loadStoppageData(true);
    }

    private async loadStoppageData(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("stoppage") as JSONModel;
        const token = window.localStorage.getItem("machineApiToken") || "";

        try {
            // ── $top=5000 + orderby asc — consecutive pair calculation ke liye zaroori ─
            const res = await fetch(
                "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/Machine?$top=5000&$orderby=Timestamp asc",
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
            const allRows = payload.value || [];

            const userStr = window.localStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : {};
            const role = String(user.Role || user.role || "").toUpperCase();
            const userId = String(user.SupervisorId || user.EmployeeId || user.userId || "");

            // Role-based filtering
            let rows = allRows;
            if (role === "SUPERVISOR" || role === "EMPLOYEE") {
                const assignedResources = this.getAssignedResources();
                const assignedResourceIds = assignedResources.map((r: any) => String(r.resourceId || r.ResourceId || "").trim().toUpperCase());
                const assignedResourceNames = assignedResources.map((r: any) => String(r.name || r.ResName || "").trim().toUpperCase());

                rows = allRows.filter((row: any) => {
                    const machineId = String(row.DeviceId || "").trim().toUpperCase();
                    const machineBrand = String(row.PlcBrand || "").trim().toUpperCase();
                    const matchesId = assignedResourceIds.includes(machineId);
                    const matchesBrand = assignedResourceNames.includes(machineBrand);
                    return matchesId || matchesBrand;
                });
            }

            // Group by DeviceId
            const deviceMap: Record<string, Array<Record<string, any>>> = {};
            rows.forEach((row) => {
                const id = String(row.DeviceId || "UNKNOWN");
                if (!deviceMap[id]) deviceMap[id] = [];
                deviceMap[id].push(row);
            });

            let totalRunMs  = 0;
            let totalStopMs = 0;
            const stoppageRows: Array<Record<string, any>> = [];

            Object.keys(deviceMap).forEach((deviceId) => {
                const deviceRows = deviceMap[deviceId];

                for (let i = 0; i < deviceRows.length - 1; i++) {
                    const current = deviceRows[i];
                    const next    = deviceRows[i + 1];

                    const currentStatus = String(current.Status || "").toUpperCase();
                    const currentTime   = this.parseTimestamp(String(current.Timestamp || ""));
                    const nextTime      = this.parseTimestamp(String(next.Timestamp    || ""));

                    if (currentTime && nextTime) {
                        const diffMs = nextTime.getTime() - currentTime.getTime();

                        if (currentStatus === "RUNNING") {
                            totalRunMs += diffMs;
                        } else if (currentStatus === "STOPPED") {
                            totalStopMs += diffMs;
                            stoppageRows.push({
                                company:     String(current.Companyname || current.CompanyName || "-"),
                                machineName: String(current.MachineName || current.Machinename || current.PlcModel || "-"),
                                deviceId:    deviceId,
                                startedAt:   this.formatTimestamp(String(current.Timestamp || "-")),
                                stoppedAt:   this.formatTimestamp(String(next.Timestamp    || "-")),
                                duration:    this.formatDuration(diffMs),
                                runTime:     this.formatDuration(diffMs),
                                idealTime:   this.formatDuration(diffMs)
                            });
                        }
                    }
                }
            });

            model.setProperty("/runTime",           this.formatDuration(totalRunMs));
            model.setProperty("/stopTime",          this.formatDuration(totalStopMs));
            model.setProperty("/idealTime",         this.formatDuration(totalRunMs));
            model.setProperty("/stoppageRows",      stoppageRows);
            model.setProperty("/stoppageTotalCount", stoppageRows.length);

            if (showToast) {
                const MessageToast = await import("sap/m/MessageToast");
                MessageToast.default.show("Data refreshed successfully");
            }

        } catch (e) {
            console.error("StoppageInfo API error:", e);
            if (showToast) {
                const MessageToast = await import("sap/m/MessageToast");
                MessageToast.default.show("Failed to load data");
            }
        }
    }

    private parseTimestamp(ts: string): Date | null {
        if (!ts) return null;
        try {
            let cleaned = ts.trim();
            cleaned = cleaned.replace(" UTC", "Z").replace(" UT", "Z");
            if (cleaned.includes(" ") && !cleaned.includes("T")) cleaned = cleaned.replace(" ", "T");
            const d = new Date(cleaned);
            return isNaN(d.getTime()) ? null : d;
        } catch { return null; }
    }

    private formatDuration(ms: number): string {
        if (ms <= 0) return "0m";
        const totalSeconds = Math.floor(ms / 1000);
        const hours   = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours   > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    }

    private formatTimestamp(ts: string): string {
        const d = this.parseTimestamp(ts);
        if (!d) return ts;
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
               ", " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toLowerCase();
    }

    public onSideItemPress(oEvent: any): void {
        const item   = oEvent.getParameter("listItem") as any;
        const title  = item.getTitle && item.getTitle();
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        const routeMap: Record<string, string> = {
            "Monitoring-Dashboard": "dashboard",  "Live Data":      "liveData",
            "Supervisor":           "supervisor",  "Employees":      "employees",
            "Machine History":      "machineHistory", "Resources":   "resources",
            "Machine Info":         "machineInfo", "Stoppage Info":  "stoppageInfo",
            "Requests":             "requests",    "Kontrolix-AI":   "kontrolixAI",
            "My Profile":           "myProfile"
        };
        const route = routeMap[title];
        if (route) router.navTo(route);
    }

    public onLogout(): void {
        window.localStorage.removeItem("machineApiToken");
        window.localStorage.removeItem("appToken");
        window.localStorage.removeItem("user");
        (this.getOwnerComponent() as UIComponent).getRouter().navTo("login");
    }

    public onSignOut(): void { this.onLogout(); }
}