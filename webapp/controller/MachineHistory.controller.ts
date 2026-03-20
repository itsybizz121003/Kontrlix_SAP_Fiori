import Controller from "./BaseController";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";

/**
 * @namespace ashu.ashu.controller
 */
export default class MachineHistory extends Controller {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const mhModel = new JSONModel({
            allRows: [],
            rows: [],
            connectionStatusText: "OFFLINE",
            connectionStatusState: "Error",
            lastUpdated: "-",
            rowCount: 0,
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            timeFilter: "all"
        });

        view.setModel(mhModel, "mh");
        void this.loadMachineHistory();
    }

    public onRefreshMachineHistory(): void {
        void this.loadMachineHistory(true);
    }

    public onSideItemPress(oEvent: any): void {
        const item  = oEvent.getParameter("listItem") as any;
        const title = item.getTitle && item.getTitle();
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        const map: Record<string, string> = {
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
        const route = map[title];
        if (route) router.navTo(route);
    }

    public onLogout(): void {
        window.localStorage.removeItem("machineApiToken");
        window.localStorage.removeItem("appToken");
        window.localStorage.removeItem("user");
        (this.getOwnerComponent() as UIComponent).getRouter().navTo("login");
    }

    public onSignOut(): void { this.onLogout(); }

    public onExportToCSV(): void {
        const model   = this.getView()?.getModel("mh") as JSONModel;
        const allRows = model.getProperty("/allRows") || [];

        if (!allRows.length) { MessageToast.show("No data to export."); return; }

        const headers    = ["Timestamp", "Company Name", "Device ID", "Model", "Status", "Part No", "Material"];
        let csvContent   = "data:text/csv;charset=utf-8,";
        csvContent      += "Kontrolix SAP Machine Data\r\n\n";
        csvContent      += headers.join(",") + "\r\n";

        allRows.forEach((row: any) => {
            const rowData = headers.map(header => {
                let cell = row[header.replace(/ /g, "")] || "";
                cell = String(cell).includes(",") ? `"${cell}"` : cell;
                return cell;
            });
            csvContent += rowData.join(",") + "\r\n";
        });

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "machine_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    public onTimeFilterChange(oEvent: any): void {
        const sKey  = oEvent.getParameter("selectedItem").getKey();
        const model = this.getView()?.getModel("mh") as JSONModel;
        model.setProperty("/timeFilter",   sKey);
        model.setProperty("/currentPage",  1);
        this.applyFiltersAndPagination();
    }

    public onPrevPage(): void {
        const model = this.getView()?.getModel("mh") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        if (currentPage > 1) {
            model.setProperty("/currentPage", currentPage - 1);
            this.applyFiltersAndPagination();
        }
    }

    public onNextPage(): void {
        const model = this.getView()?.getModel("mh") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        const totalPages  = model.getProperty("/totalPages");
        if (currentPage < totalPages) {
            model.setProperty("/currentPage", currentPage + 1);
            this.applyFiltersAndPagination();
        }
    }

    private applyFiltersAndPagination(): void {
        const model      = this.getView()?.getModel("mh") as JSONModel;
        const allRows    = model.getProperty("/allRows")    || [];
        const timeFilter = model.getProperty("/timeFilter") || "all";
        const currentPage = model.getProperty("/currentPage") || 1;
        const pageSize    = model.getProperty("/pageSize")    || 10;

        let filteredRows = allRows;
        if (timeFilter !== "all") {
            const now = new Date();
            let startDate: Date;

            switch (timeFilter) {
                case "today":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "yesterday":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                    break;
                case "thisWeek":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                    break;
                case "last3Months":
                    startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                    break;
                default:
                    startDate = new Date(0);
            }

            filteredRows = allRows.filter((row: any) => {
                const rowDate = new Date(row.Timestamp);
                if (timeFilter === "yesterday") {
                    return rowDate.getFullYear() === startDate.getFullYear() &&
                           rowDate.getMonth()    === startDate.getMonth()    &&
                           rowDate.getDate()     === startDate.getDate();
                }
                return rowDate >= startDate;
            });
        }

        const totalRows  = filteredRows.length;
        const totalPages = Math.ceil(totalRows / pageSize) || 1;
        const start      = (currentPage - 1) * pageSize;
        const pagedRows  = filteredRows.slice(start, start + pageSize);

        model.setProperty("/rows",       pagedRows);
        model.setProperty("/rowCount",   totalRows);
        model.setProperty("/totalPages", totalPages);
    }

    private async loadMachineHistory(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model     = view.getModel("mh") as JSONModel;
        // ── getAuthToken is protected in BaseController ──────────────────
        const authToken = this.getAuthToken();

        if (!authToken) {
            model.setProperty("/connectionStatusText",  "TOKEN MISSING");
            model.setProperty("/connectionStatusState", "Warning");
            if (showToast) MessageToast.show("machineApiToken not found in browser storage");
            return;
        }

        const basePath = "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/";
        let nextUrl    = `${basePath}Machine?$orderby=Timestamp desc`;
        const allRows: Array<Record<string, any>> = [];

        try {
            for (let safety = 0; safety < 50 && nextUrl; safety++) {
                const res = await fetch(nextUrl, {
                    method: "GET",
                    headers: { "Accept": "application/json", "Authorization": `Bearer ${authToken}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const payload = await res.json() as {
                    value?: Array<Record<string, any>>;
                    "@odata.nextLink"?: string;
                    "odata.nextLink"?: string;
                };

                allRows.push(...(payload.value || []));

                const maybeNext = payload["@odata.nextLink"] || payload["odata.nextLink"] || "";
                if (!maybeNext) { nextUrl = ""; break; }

                if (maybeNext.startsWith("http")) {
                    try {
                        const parsed = new URL(maybeNext, window.location.origin);
                        nextUrl = parsed.pathname + parsed.search;
                    } catch { nextUrl = maybeNext; }
                } else {
                    nextUrl = basePath + maybeNext;
                }
            }

            // ── getAssignedResources is protected in BaseController ───────
            const userStr = window.localStorage.getItem("user");
            const user    = userStr ? JSON.parse(userStr) as Record<string, any> : {};
            const role    = String(user.Role || user.role || "").toUpperCase();

            let filteredAllRows = allRows;
            if (role === "SUPERVISOR" || role === "EMPLOYEE") {
                const assignedResources     = this.getAssignedResources();
                const assignedResourceIds   = assignedResources.map((r: any) => String(r.resourceId  || r.ResourceId  || "").trim().toUpperCase());
                const assignedResourceNames = assignedResources.map((r: any) => String(r.name || r.ResName || "").trim().toUpperCase());

                filteredAllRows = allRows.filter((row: any) => {
                    const machineId    = String(row.DeviceId || "").trim().toUpperCase();
                    const machineBrand = String(row.PlcBrand || "").trim().toUpperCase();
                    return assignedResourceIds.includes(machineId) || assignedResourceNames.includes(machineBrand);
                });
            }

            model.setProperty("/allRows", filteredAllRows);
            this.applyFiltersAndPagination();

            model.setProperty("/connectionStatusText",  "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());

            if (showToast) MessageToast.show(`Loaded ${allRows.length} rows`);

        } catch (error) {
            model.setProperty("/connectionStatusText",  "OFFLINE");
            model.setProperty("/connectionStatusState", "Error");
            if (showToast) MessageToast.show("Failed to load machine history");
            console.error("Machine history API error:", error);
        }
    }

    // ── These are protected in BaseController — override access modifier ──
    public getAuthToken(): string {
        return (
            window.localStorage.getItem("machineApiToken")  ||
            window.sessionStorage.getItem("machineApiToken") ||
            ""
        );
    }

    public getAssignedResources(): Array<Record<string, any>> {
        try {
            const str = window.localStorage.getItem("assignedResources") || "[]";
            return JSON.parse(str) as Array<Record<string, any>>;
        } catch { return []; }
    }
}