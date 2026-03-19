import Controller from "./BaseController";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";

/**
 * @namespace ashu.ashu.controller
 */
export default class Dashboard extends Controller {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const userStr = window.localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) as Record<string, any> : {};
        const firstName = String(user.firstName || "User");
        const lastName  = String(user.lastName  || "");

        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
        });

        const dashModel = new JSONModel({
            greeting: `${greeting}, ${firstName} ${lastName}`.trim(),
            date: dateStr,
            initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
            connectionStatus: "OFFLINE",
            connectionState:  "Error",
            lastUpdated: "-",
            allRows: [],
            brands: [{ key: "all", text: "All Brands" }],
            filters: { plcBrand: "all", machineStatus: "all", dateRange: "all" },
            totalMachines:    0,
            runningCount:     0,
            stoppedCount:     0,
            totalProduction:  0,
            uniqueParameters: 0,
            runTime:    "0m",
            stopTime:   "0m",
            runPercent:  "0%",
            stopPercent: "0%",
            totalTime:  "0m",
            stoppageRows: [],
            historyRows:  [],
            timeChartData: [
                { type: "Run Time",  minutes: 0.1 },
                { type: "Stop Time", minutes: 0.1 }
            ],
            chartData: []
        });

        view.setModel(dashModel, "dash");
        void this.loadDashboardData();
    }

    public onRefresh(): void { void this.loadDashboardData(true); }

    public onFilterChange(): void { this.applyFilters(); }

    public onResetFilters(): void {
        const view = this.getView();
        if (!view) return;
        const model = view.getModel("dash") as JSONModel;
        model.setProperty("/filters", { plcBrand: "all", machineStatus: "all", dateRange: "all" });
        this.applyFilters();
    }

    public onViewAllHistory(): void {
        (this.getOwnerComponent() as UIComponent).getRouter().navTo("machineHistory");
    }

    private async loadDashboardData(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;
        const model = view.getModel("dash") as JSONModel;
        const token = window.localStorage.getItem("machineApiToken") || "";

        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/Machine?$top=5000&$orderby=Timestamp asc",
                { method: "GET", headers: { "Accept": "application/json", "Authorization": `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const payload = await res.json() as { value?: Array<Record<string, any>> };
            const allRows = payload.value || [];

            const brandsSet = new Set<string>();
            allRows.forEach((r: any) => { if (r.PlcBrand) brandsSet.add(String(r.PlcBrand)); });
            const brandItems = [{ key: "all", text: "All Brands" }];
            Array.from(brandsSet).sort().forEach(b => brandItems.push({ key: b, text: b }));
            model.setProperty("/brands", brandItems);

            model.setProperty("/allRows", allRows);
            model.setProperty("/connectionStatus", "ONLINE");
            model.setProperty("/connectionState",  "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());

            this.applyFilters();

        } catch (error) {
            model.setProperty("/connectionStatus", "OFFLINE");
            model.setProperty("/connectionState",  "Error");
            console.error("Dashboard data API error:", error);
        }
    }

    private applyFilters(): void {
        const view = this.getView();
        if (!view) return;
        const model   = view.getModel("dash") as JSONModel;
        const allRows = model.getProperty("/allRows") || [];
        const filters = model.getProperty("/filters");

        const userStr = window.localStorage.getItem("user");
        const user    = userStr ? JSON.parse(userStr) as Record<string, any> : {};
        const role    = String(user.Role || user.role || "").toUpperCase();
        const userId  = String(user.SupervisorId || user.EmployeeId || user.userId || "");

        // 1. Role-based filtering + UI Filters
        let filteredRows = allRows.filter((row: any) => {
            // Role Logic
            if (role === "SUPERVISOR" || role === "EMPLOYEE") {
                // Supervisor and Employee see data for assigned resources
                const assignedResources = this.getAssignedResources();
                const assignedResourceIds = assignedResources.map((r: any) => String(r.resourceId || r.ResourceId || "").trim().toUpperCase());
                const assignedResourceNames = assignedResources.map((r: any) => String(r.name || r.ResName || "").trim().toUpperCase());
                
                const machineId = String(row.DeviceId || "").trim().toUpperCase();
                const machineBrand = String(row.PlcBrand || "").trim().toUpperCase();

                const matchesId = assignedResourceIds.includes(machineId);
                const matchesBrand = assignedResourceNames.includes(machineBrand);

                if (!matchesId && !matchesBrand) {
                    return false;
                }
            }
            if (filters.plcBrand !== "all" && String(row.PlcBrand) !== filters.plcBrand) return false;
            if (filters.dateRange !== "all") {
                const rowDate = this.parseTimestamp(String(row.Timestamp || ""));
                if (!rowDate) return false;
                const now = new Date();
                let minDate = new Date();
                switch (filters.dateRange) {
                    case "today":      minDate.setHours(0,0,0,0); break;
                    case "yesterday": {
                        minDate.setDate(now.getDate() - 1); minDate.setHours(0,0,0,0);
                        const maxDate = new Date(minDate); maxDate.setHours(23,59,59,999);
                        if (rowDate < minDate || rowDate > maxDate) return false;
                        return true;
                    }
                    case "thisWeek":    minDate.setDate(now.getDate() - now.getDay()); minDate.setHours(0,0,0,0); break;
                    case "thisMonth":   minDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
                    case "last3Months": minDate.setMonth(now.getMonth() - 3); break;
                }
                if (rowDate < minDate) return false;
            }
            return true;
        });

        // 2. Group by device
        const deviceMap: Record<string, Array<Record<string, any>>> = {};
        filteredRows.forEach((row: any) => {
            const id = String(row.DeviceId || "UNKNOWN");
            if (!deviceMap[id]) deviceMap[id] = [];
            deviceMap[id].push(row);
        });

        // 3. Status filter on latest record per device
        if (filters.machineStatus !== "all") {
            Object.keys(deviceMap).forEach((id) => {
                const rows   = deviceMap[id];
                const lastRow = rows[rows.length - 1];
                if (String(lastRow.Status || "").toUpperCase() !== filters.machineStatus) {
                    delete deviceMap[id];
                }
            });
        }

        // 4. Run/Stop time calculation
        let totalRunMs  = 0;
        let totalStopMs = 0;
        const stoppageRows: Array<Record<string, any>> = [];
        const historyRows:  Array<Record<string, any>> = [];

        Object.keys(deviceMap).forEach((deviceId) => {
            const deviceRows = deviceMap[deviceId];
            for (let i = 0; i < deviceRows.length - 1; i++) {
                const current = deviceRows[i];
                const next    = deviceRows[i + 1];
                const currentStatus = String(current.Status || "").toUpperCase();
                const nextStatus    = String(next.Status    || "").toUpperCase();
                const currentTime   = this.parseTimestamp(String(current.Timestamp || ""));
                const nextTime      = this.parseTimestamp(String(next.Timestamp    || ""));

                if (currentTime && nextTime) {
                    const diffMs = nextTime.getTime() - currentTime.getTime();
                    if (currentStatus === "RUNNING") {
                        totalRunMs += diffMs;
                    } else if (currentStatus === "STOPPED") {
                        totalStopMs += diffMs;
                        stoppageRows.push({
                            company:   String(current.Companyname || "-"),
                            deviceId,
                            stopTime:  String(current.Timestamp || "-"),
                            startTime: String(next.Timestamp    || "-"),
                            duration:  this.formatDuration(diffMs)
                        });
                    }
                }
                if (currentStatus !== nextStatus) {
                    historyRows.push({
                        timestamp:    String(next.Timestamp || "-"),
                        machine:      deviceId,
                        previous:     currentStatus,
                        current:      nextStatus,
                        currentState: nextStatus === "RUNNING" ? "Success" : "Error"
                    });
                }
            }
        });

        // 5. Per-device last-record metrics
        let totalProduction = 0;
        let runningCount    = 0;
        let stoppedCount    = 0;
        const paramKeySet   = new Set<string>();

        Object.keys(deviceMap).forEach((devId) => {
            const lastRow = deviceMap[devId][deviceMap[devId].length - 1];
            if (!lastRow) return;
            let params: Record<string, any> = {};
            try { params = JSON.parse(String(lastRow.Parameters || "{}")); } catch { params = {}; }
            totalProduction += Number(params.PRODUCTION_COUNT ?? lastRow.ProductionCount ?? 0);
            Object.keys(params).forEach((k) => paramKeySet.add(k));
            const lastStatus = String(lastRow.Status || "").toUpperCase();
            if      (lastStatus === "RUNNING") runningCount++;
            else if (lastStatus === "STOPPED") stoppedCount++;
        });

        // 6. Derived values
        const totalMs = totalRunMs + totalStopMs;
        const runPct  = totalMs > 0 ? Math.round((totalRunMs  / totalMs) * 100) : 0;
        const stopPct = totalMs > 0 ? Math.round((totalStopMs / totalMs) * 100) : 0;

        historyRows.sort((a, b) =>
            (this.parseTimestamp(b.timestamp)?.getTime() || 0) -
            (this.parseTimestamp(a.timestamp)?.getTime() || 0)
        );

        // 7. Model update
        model.setProperty("/totalMachines",    Object.keys(deviceMap).length);
        model.setProperty("/runningCount",     runningCount);
        model.setProperty("/stoppedCount",     stoppedCount);
        model.setProperty("/totalProduction",  totalProduction);
        model.setProperty("/uniqueParameters", paramKeySet.size);
        model.setProperty("/runTime",          this.formatDuration(totalRunMs));
        model.setProperty("/stopTime",         this.formatDuration(totalStopMs));
        model.setProperty("/totalTime",        this.formatDuration(totalMs));
        model.setProperty("/runPercent",       `${runPct}%`);
        model.setProperty("/stopPercent",      `${stopPct}%`);
        model.setProperty("/stoppageRows",     stoppageRows.slice(0, 5));
        model.setProperty("/historyRows",      historyRows.slice(0, 5));

        // 8. Donut chart data
        model.setProperty("/timeChartData", [
            { type: "Run Time",  minutes: totalRunMs  > 0 ? Math.round(totalRunMs  / 60000) : 0.1 },
            { type: "Stop Time", minutes: totalStopMs > 0 ? Math.round(totalStopMs / 60000) : 0.1 }
        ]);

        // 9. Bar chart data — field names MUST match view bindings exactly
        //    View uses: {dash>label}, {dash>production}, {dash>temperature}, {dash>rpm}, {dash>pressure}
        const chartData: Array<any> = [];
        Object.keys(deviceMap).forEach((id) => {
            const rows = deviceMap[id];
            const last = rows[rows.length - 1];
            if (!last) return;

            let params: Record<string, any> = {};
            try { params = JSON.parse(String(last.Parameters || "{}")); } catch { params = {}; }

            chartData.push({
                label:       id,
                production:  Number(params.PRODUCTION_COUNT ?? last.ProductionCount ?? 0),
                temperature: Number(params.TEMPERATURE      ?? last.Temperature      ?? 0),
                rpm:         Number(params.RPM              ?? last.Rpm              ?? 0),
                pressure:    Number(params.PRESSURE         ?? last.Pressure         ?? 0)
            });
        });
        model.setProperty("/chartData", chartData);

        // 10. Chart colors via setVizProperties
        setTimeout(() => {
            const donutChart = this.byId("timeSummaryChart") as any;
            if (donutChart) {
                donutChart.setVizProperties({
                    title:   { visible: false },
                    tooltip: { visible: true },
                    plotArea: {
                        colorPalette: ["#19A979", "#eb0d0d"],
                        dataLabel: { visible: true, type: "percentage" }
                    },
                    chart: { innerRadius: "50%" }
                });
            }

            const productionChart = this.byId("productionChart") as any;
            if (productionChart) {
                productionChart.setVizProperties({
                    title:   { visible: false },
                    tooltip: { visible: true },
                    plotArea: {
                        colorPalette: ["#5899DA", "#E8743B"],
                        dataLabel: { visible: true, formatString: "#,##0" }
                    },
                    valueAxis:  { title: { text: "Production" } },
                    valueAxis2: { title: { text: "Temperature (°C)" } }
                });
            }

            const rpmChart = this.byId("rpmChart") as any;
            if (rpmChart) {
                rpmChart.setVizProperties({
                    title:   { visible: false },
                    tooltip: { visible: true },
                    plotArea: {
                        colorPalette: ["#19A979", "#945ECF"],
                        dataLabel: { visible: true, formatString: "#,##0.#" }
                    },
                    valueAxis:  { title: { text: "RPM" } },
                    valueAxis2: { title: { text: "Pressure (bar)" } }
                });
            }
        }, 100);
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

    public onLogout(): void {
        window.localStorage.clear();
        (this.getOwnerComponent() as UIComponent).getRouter().navTo("login");
    }

    public onSignOut(): void { this.onLogout(); }
}