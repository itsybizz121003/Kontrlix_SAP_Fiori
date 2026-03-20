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
            allStoppageRows: [], // Unfiltered data
            stoppageRows: [],    // Displayed data
            stoppageTotalCount: 0,
            selectedTime: "allTime",
            timeOptions: [
                { key: "allTime", text: "All Time" },
                { key: "today", text: "Today" },
                { key: "yesterday", text: "Yesterday" },
                { key: "thisWeek", text: "This Week" },
                { key: "thisMonth", text: "This Month" },
                { key: "lastThreeMonths", text: "Last 3 Months" }
            ],
            selectedMachine: "allMachines",
            machineList: [{ key: "allMachines", text: "All Machines" }],
            // Pagination
            currentPage: 1,
            pageSize: 10,
            totalPages: 1
        });

        view.setModel(stoppageModel, "stoppage");
        void this.loadStoppageData();
    }

    public onRefresh(): void {
        void this.loadStoppageData(true);
    }

    public onFilterChange(): void {
        const model = this.getView()?.getModel("stoppage") as JSONModel;
        model.setProperty("/currentPage", 1); // Reset to first page on filter change
        this.applyFilters();
    }

    public onPreviousPage(): void {
        const model = this.getView()?.getModel("stoppage") as JSONModel;
        const current = model.getProperty("/currentPage") as number;
        if (current > 1) {
            model.setProperty("/currentPage", current - 1);
            this.applyFilters();
        }
    }

    public onNextPage(): void {
        const model = this.getView()?.getModel("stoppage") as JSONModel;
        const current = model.getProperty("/currentPage") as number;
        const total = model.getProperty("/totalPages") as number;
        if (current < total) {
            model.setProperty("/currentPage", current + 1);
            this.applyFilters();
        }
    }

    private applyFilters(): void {
        const view = this.getView();
        if (!view) return;
        const model = view.getModel("stoppage") as JSONModel;
        const allRows = model.getProperty("/allStoppageRows") as any[];
        const selectedTime = model.getProperty("/selectedTime");
        const selectedMachine = model.getProperty("/selectedMachine");
        const currentPage = model.getProperty("/currentPage") as number;
        const pageSize = model.getProperty("/pageSize") as number;

        let filteredRows = allRows;

        // 1. Time Filter
        if (selectedTime !== "allTime") {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            filteredRows = filteredRows.filter(row => {
                const rowDate = this.parseTimestamp(row.timestampRaw);
                if (!rowDate) return false;

                switch (selectedTime) {
                    case "today":
                        return rowDate >= startOfToday;
                    case "yesterday":
                        const startOfYesterday = new Date(startOfToday);
                        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
                        return rowDate >= startOfYesterday && rowDate < startOfToday;
                    case "thisWeek":
                        const startOfWeek = new Date(startOfToday);
                        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
                        return rowDate >= startOfWeek;
                    case "thisMonth":
                        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                        return rowDate >= startOfMonth;
                    case "lastThreeMonths":
                        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                        return rowDate >= threeMonthsAgo;
                    default:
                        return true;
                }
            });
        }

        // 2. Machine Filter
        if (selectedMachine !== "allMachines") {
            filteredRows = filteredRows.filter(row => row.deviceId === selectedMachine);
        }

        // 3. Recalculate totals for filtered rows (before pagination)
        let runMs = 0;
        let stopMs = 0;
        const allFilteredTableRows: any[] = [];

        filteredRows.forEach(row => {
            if (row.statusRaw === "RUNNING") {
                runMs += row.durationMs;
            } else if (row.statusRaw === "STOPPED") {
                stopMs += row.durationMs;
                allFilteredTableRows.push(row);
            }
        });

        // 4. Pagination slicing
        const totalItems = allFilteredTableRows.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedRows = allFilteredTableRows.slice(startIndex, endIndex);

        model.setProperty("/stoppageRows", paginatedRows);
        model.setProperty("/stoppageTotalCount", totalItems);
        model.setProperty("/totalPages", totalPages);
        model.setProperty("/runTime", this.formatDuration(runMs));
        model.setProperty("/stopTime", this.formatDuration(stopMs));
        model.setProperty("/idealTime", this.formatDuration(runMs));
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

            const deviceMap: Record<string, Array<Record<string, any>>> = {};
            const machineList = [{ key: "allMachines", text: "All Machines" }];
            const deviceIds = new Set<string>();

            rows.forEach((row) => {
                const id = String(row.DeviceId || "UNKNOWN");
                if (!deviceMap[id]) deviceMap[id] = [];
                deviceMap[id].push(row);
                
                if (id !== "UNKNOWN" && !deviceIds.has(id)) {
                    deviceIds.add(id);
                    machineList.push({ key: id, text: id });
                }
            });

            model.setProperty("/machineList", machineList);

            let totalRunMs  = 0;
            let totalStopMs = 0;
            const allStoppageRows: Array<Record<string, any>> = [];

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
                        }

                        // We store all pairs to allow filtering later, 
                        // but only display STOPPED ones in the table if they are stoppages
                        allStoppageRows.push({
                            company:     String(current.Companyname || current.CompanyName || "-"),
                            machineName: String(current.MachineName || current.Machinename || current.PlcModel || "-"),
                            deviceId:    deviceId,
                            startedAt:   this.formatTimestamp(String(current.Timestamp || "-")),
                            stoppedAt:   this.formatTimestamp(String(next.Timestamp    || "-")),
                            duration:    this.formatDuration(diffMs),
                            runTime:     this.formatDuration(diffMs),
                            idealTime:   this.formatDuration(diffMs),
                            // Metadata for filtering
                            statusRaw:    currentStatus,
                            timestampRaw: String(current.Timestamp || ""),
                            durationMs:   diffMs
                        });

                        if (currentStatus === "STOPPED") {
                            totalStopMs += diffMs;
                        }
                    }
                }
            });

            model.setProperty("/allStoppageRows", allStoppageRows);
            this.applyFilters(); // This will set /stoppageRows and totals based on current filters

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