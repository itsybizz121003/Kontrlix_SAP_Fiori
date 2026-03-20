import Controller from "./BaseController";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ashu.ashu.controller
 */
export default class MachineInfo extends Controller {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const machineModel = new JSONModel({
            allMachineRows: [], // Original un-filtered data
            machineRows: [],    // Displayed (potentially filtered) data
            machineTotalCount: 0,
            selectedMachine: "allMachines",
            companyList: [{ key: "All", text: "All Companies" }],
            selectedCompany: "All"
        });

        view.setModel(machineModel, "machineInfo");
        void this.loadMachineInfoData();
    }

    public onRefresh(): void {
        void this.loadMachineInfoData(true);
    }

    public onCompanyFilter(oEvent: any): void {
        const selectedKey = oEvent.getSource().getSelectedKey();
        this.applyCompanyFilter(selectedKey);
    }

    private applyCompanyFilter(companyKey: string): void {
        const view = this.getView();
        if (!view) return;
        const model = view.getModel("machineInfo") as JSONModel;
        const allRows = model.getProperty("/allMachineRows") as any[];

        let filteredRows = allRows;
        if (companyKey !== "All") {
            filteredRows = allRows.filter((row: any) => row.company === companyKey);
        }

        model.setProperty("/machineRows", filteredRows);
        model.setProperty("/machineTotalCount", filteredRows.length);
    }

    private async loadMachineInfoData(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("machineInfo") as JSONModel;
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

            // Group rows by DeviceId — same as Dashboard
            const deviceMap: Record<string, Array<Record<string, any>>> = {};
            rows.forEach((row) => {
                const id = String(row.DeviceId || "UNKNOWN");
                if (!deviceMap[id]) deviceMap[id] = [];
                deviceMap[id].push(row);
            });

            // Pick the LATEST record per device and build display rows
            const machineRows: Array<Record<string, any>> = [];

            Object.keys(deviceMap).forEach((deviceId) => {
                const deviceRows = deviceMap[deviceId];
                // Last element = most recent (rows are ordered by Timestamp asc)
                const latest = deviceRows[deviceRows.length - 1];
                if (!latest) return;

                // Parse Parameters JSON (same as Dashboard chartData logic)
                let params: Record<string, any> = {};
                try {
                    params = JSON.parse(String(latest.Parameters || "{}")) as Record<string, any>;
                } catch {
                    params = {};
                }

                const status = String(latest.Status || "").toUpperCase();

                machineRows.push({
                    company:     String(latest.Companyname  || latest.CompanyName  || "-"),
                    machineName: String(latest.MachineName  || latest.Machinename  || "-"),
                    deviceId:    deviceId,
                    // PLC / motor status
                    plcStatus:   status,
                    plcState:    status === "RUNNING" ? "Success" : "Error",
                    motorStatus: status === "RUNNING" ? "ACTIVE"  : "INACTIVE",
                    motorState:  status === "RUNNING" ? "Success" : "Error",
                    // Assigned operator / product (extend when API provides these fields)
                    assigned:    String(latest.AssignedTo   || latest.material     || "-"),
                    product:     String(latest.ProductName  || latest.Product      || "No product"),
                    // Sensor readings
                    temperature: Number(params.TEMPERATURE       ?? latest.Temperature       ?? 0).toFixed(1),
                    rpm:         Number(params.RPM                ?? latest.Rpm               ?? 0),
                    pressure:    Number(params.PRESSURE           ?? latest.Pressure          ?? 0).toFixed(1),
                    production:  Number(params.PRODUCTION_COUNT   ?? latest.ProductionCount   ?? 0),
                    // Last seen timestamp
                    lastSeen:    this.formatTimestamp(String(latest.Timestamp || "-"))
                });
            });

            // Set original and display data
            model.setProperty("/allMachineRows", machineRows);
            model.setProperty("/machineRows", machineRows);
            model.setProperty("/machineTotalCount", machineRows.length);

            // Populate Company Filter List
            const companiesSet = new Set<string>();
            machineRows.forEach((row) => {
                if (row.company && row.company !== "-") companiesSet.add(row.company);
            });

            const companyList = [{ key: "All", text: "All Companies" }];
            Array.from(companiesSet).sort().forEach((comp) => {
                companyList.push({ key: comp, text: comp });
            });
            model.setProperty("/companyList", companyList);

            // Apply existing filter if any
            const selectedComp = model.getProperty("/selectedCompany");
            if (selectedComp && selectedComp !== "All") {
                this.applyCompanyFilter(selectedComp);
            }

            if (showToast) {
                const MessageToast = await import("sap/m/MessageToast");
                MessageToast.default.show("Data refreshed successfully");
            }

        } catch (e) {
            console.error("MachineInfo API error:", e);
            if (showToast) {
                const MessageToast = await import("sap/m/MessageToast");
                MessageToast.default.show("Failed to load data");
            }
        }
    }

    // ── Timestamp parser (identical to Dashboard) ───────────────────────────
    private parseTimestamp(ts: string): Date | null {
        if (!ts) return null;
        try {
            let cleaned = ts.trim();
            cleaned = cleaned.replace(" UTC", "Z");
            cleaned = cleaned.replace(" UT",  "Z");
            if (cleaned.includes(" ") && !cleaned.includes("T")) {
                cleaned = cleaned.replace(" ", "T");
            }
            const d = new Date(cleaned);
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    }

    // ── Human-readable timestamp ─────────────────────────────────────────────
    private formatTimestamp(ts: string): string {
        const d = this.parseTimestamp(ts);
        if (!d) return ts;
        return d.toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric"
        }) + ", " + d.toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
            hour12: true
        }).toLowerCase();
    }

    // ── Side navigation ──────────────────────────────────────────────────────
    public onSideItemPress(oEvent: any): void {
        const item = oEvent.getParameter("listItem") as any;
        const title = item.getTitle && item.getTitle();
        const router = (this.getOwnerComponent() as UIComponent).getRouter();

        const routeMap: Record<string, string> = {
            "Monitoring-Dashboard": "dashboard",
            "Live Data":            "liveData",
            "Supervisor":           "supervisor",
            "Employees":            "employees",
            "Machine History":      "machineHistory",
            "Resources":            "resources",
            "Machine Info":         "machineInfo",
            "Stoppage Info":        "stoppageInfo",
            "Requests":             "requests",
            "Kontrolix-AI":         "kontrolixAI",
            "My Profile":           "myProfile"
        };

        const route = routeMap[title];
        if (route) router.navTo(route);
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