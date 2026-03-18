import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";

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
        const lastName = String(user.lastName || "");

        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good Morning" :
                         hour < 17 ? "Good Afternoon" : "Good Evening";

        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", {
            weekday: "long", year: "numeric",
            month: "long", day: "numeric"
        });

        const dashModel = new JSONModel({
            greeting: `${greeting}, ${firstName} ${lastName}`.trim(),
            date: dateStr,
            initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
            connectionStatus: "OFFLINE",
            connectionState: "Error",
            lastUpdated: "-",
            totalMachines: 0,
            runningCount: 0,
            stoppedCount: 0,
            runTime: "0m",
            stopTime: "0m",
            runPercent: "0%",
            stopPercent: "0%",
            totalTime: "0m",
            stoppageRows: [],
            historyRows: [],
            selectedBrand: "allBrands",
            selectedStatus: "allStatus",
            timeChartData: [
                { type: "Run Time", minutes: 0.1 },
                { type: "Stop Time", minutes: 0.1 }
            ],
            chartData: []
        });

        view.setModel(dashModel, "dash");
        void this.loadDashboardData();
    }

    public onRefresh(): void {
        void this.loadDashboardData(true);
    }

    public onResetFilters(): void {
        const view = this.getView();
        if (!view) return;
        const model = view.getModel("dash") as JSONModel;
        model.setProperty("/selectedBrand", "allBrands");
        model.setProperty("/selectedStatus", "allStatus");
        void this.loadDashboardData();
    }

    private async loadDashboardData(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("dash") as JSONModel;
        const token = window.localStorage.getItem("machineApiToken") || "";

        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/Machine?$top=500&$orderby=Timestamp asc",
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

            // Device ke hisaab se group karo
            const deviceMap: Record<string, Array<Record<string, any>>> = {};
            rows.forEach((row) => {
                const id = String(row.DeviceId || "UNKNOWN");
                if (!deviceMap[id]) deviceMap[id] = [];
                deviceMap[id].push(row);
            });

            let totalRunMs = 0;
            let totalStopMs = 0;
            const stoppageRows: Array<Record<string, any>> = [];
            const historyRows: Array<Record<string, any>> = [];

            // Har device ke liye calculate karo
            Object.keys(deviceMap).forEach((deviceId) => {
                const deviceRows = deviceMap[deviceId];

                for (let i = 0; i < deviceRows.length - 1; i++) {
                    const current = deviceRows[i];
                    const next = deviceRows[i + 1];

                    const currentStatus = String(current.Status || "").toUpperCase();
                    const nextStatus = String(next.Status || "").toUpperCase();

                    const currentTime = this.parseTimestamp(String(current.Timestamp || ""));
                    const nextTime = this.parseTimestamp(String(next.Timestamp || ""));

                    if (currentTime && nextTime) {
                        const diffMs = nextTime.getTime() - currentTime.getTime();

                        if (currentStatus === "RUNNING") {
                            totalRunMs += diffMs;
                        } else if (currentStatus === "STOPPED") {
                            totalStopMs += diffMs;
                            stoppageRows.push({
                                company: String(current.Companyname || "-"),
                                deviceId: deviceId,
                                stopTime: String(current.Timestamp || "-"),
                                startTime: String(next.Timestamp || "-"),
                                duration: this.formatDuration(diffMs)
                            });
                        }
                    }

                    if (currentStatus !== nextStatus) {
                        historyRows.push({
                            timestamp: String(next.Timestamp || "-"),
                            machine: deviceId,
                            previous: currentStatus,
                            current: nextStatus,
                            currentState: nextStatus === "RUNNING" ? "Success" : "Error"
                        });
                    }
                }
            });

            // Format
            const runTimeStr = this.formatDuration(totalRunMs);
            const stopTimeStr = this.formatDuration(totalStopMs);
            const totalMs = totalRunMs + totalStopMs;
            const runPct = totalMs > 0 ? Math.round((totalRunMs / totalMs) * 100) : 0;
            const stopPct = totalMs > 0 ? Math.round((totalStopMs / totalMs) * 100) : 0;

            // Model update
            model.setProperty("/totalMachines", rows.length);
            model.setProperty("/runningCount", rows.filter((r) => String(r.Status || "").toUpperCase() === "RUNNING").length);
            model.setProperty("/stoppedCount", rows.filter((r) => String(r.Status || "").toUpperCase() === "STOPPED").length);
            model.setProperty("/runTime", runTimeStr);
            model.setProperty("/stopTime", stopTimeStr);
            model.setProperty("/totalTime", this.formatDuration(totalMs));
            model.setProperty("/runPercent", `${runPct}%`);
            model.setProperty("/stopPercent", `${stopPct}%`);
            model.setProperty("/stoppageRows", stoppageRows.slice(0, 5));
            model.setProperty("/historyRows", historyRows.slice(0, 5));
            model.setProperty("/connectionStatus", "ONLINE");
            model.setProperty("/connectionState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleTimeString());

            // Time Donut Chart Data
            const runMinutes = Math.floor(totalRunMs / 60000);
            const stopMinutes = Math.floor(totalStopMs / 60000);
            model.setProperty("/timeChartData", [
                { type: "Run Time", minutes: runMinutes > 0 ? runMinutes : 0.1 },
                { type: "Stop Time", minutes: stopMinutes > 0 ? stopMinutes : 0.1 }
            ]);

            // Bar Chart Data
            const latestPerDevice: Array<Record<string, any>> = [];
            Object.keys(deviceMap).forEach((id) => {
                const deviceRows = deviceMap[id];
                const latest = deviceRows[deviceRows.length - 1];
                if (latest) latestPerDevice.push(latest);
            });

            const chartData = latestPerDevice.map((r) => {
                let params: Record<string, any> = {};
                try {
                    params = JSON.parse(String(r.Parameters || "{}")) as Record<string, any>;
                } catch {
                    params = {};
                }
                return {
                    label: String(r.DeviceId || ""),
                    temperature: Number(params.TEMPERATURE ?? r.Temperature ?? 0),
                    production: Number(params.PRODUCTION_COUNT ?? r.ProductionCount ?? 0),
                    rpm: Number(params.RPM ?? r.Rpm ?? 0),
                    pressure: Number(params.PRESSURE ?? r.Pressure ?? 0)
                };
            });
            model.setProperty("/chartData", chartData);

            // Chart Properties
            setTimeout(() => {
                // Donut Chart
                const timeSummaryChart = this.byId("timeSummaryChart") as any;
                if (timeSummaryChart) {
                    timeSummaryChart.setVizProperties({
                        title: { visible: true },
                        tooltip: { visible: true },
                        plotArea: {
                            colorPalette: ["#19A979", "#eb0d0d"],
                            dataLabel: {
                                visible: true,
                                type: "percentage"
                            }
                        },
                        chart: {
            innerRadius: "50%"  // ← Yeh add karo — bada = thinner ring
        }
                    });
                }

                // Production Chart
                const productionChart = this.byId("productionChart") as any;
                if (productionChart) {
                    productionChart.setVizProperties({
                        title: { visible: false },
                        tooltip: { visible: true },
                        plotArea: {
                            colorPalette: ["#5899DA", "#E8743B"],
                            dataLabel: { visible: true, formatString: "#,##0.#" }
                        },
                        valueAxis: { title: { text: "Production" } },
                        valueAxis2: { title: { text: "Temperature (°C)" } }
                    });
                }

                // RPM Chart
                const rpmChart = this.byId("rpmChart") as any;
                if (rpmChart) {
                    rpmChart.setVizProperties({
                        title: { visible: false },
                        tooltip: { visible: true },
                        plotArea: {
                            colorPalette: ["#19A979", "#945ECF"],
                            dataLabel: { visible: true, formatString: "#,##0.#" }
                        },
                        valueAxis: { title: { text: "RPM" } },
                        valueAxis2: { title: { text: "Pressure (bar)" } }
                    });
                }
            }, 100);

        } catch (e) {
            model.setProperty("/connectionStatus", "OFFLINE");
            model.setProperty("/connectionState", "Error");
            console.error("Dashboard API error:", e);
        }
    }

    private parseTimestamp(ts: string): Date | null {
        if (!ts) return null;
        try {
            let cleaned = ts.trim();
            cleaned = cleaned.replace(" UTC", "Z");
            cleaned = cleaned.replace(" UT", "Z");
            if (cleaned.includes(" ") && !cleaned.includes("T")) {
                cleaned = cleaned.replace(" ", "T");
            }
            const d = new Date(cleaned);
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    }

    private formatDuration(ms: number): string {
        if (ms <= 0) return "0m";
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds    % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        else if (minutes > 0) return `${minutes}m ${seconds}s`;
        else return `${seconds}s`;
    }

  

    public onLogout(): void {
        window.localStorage.removeItem("machineApiToken");
        window.localStorage.removeItem("appToken");
        window.localStorage.removeItem("user");
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        router.navTo("login");
    }

    public onSignOut(): void {
        this.onLogout();
    }
}