import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";

/**
 * @namespace ashu.ashu.controller
 */
export default class MachineHistory extends Controller {

    public onInit(): void {
        const view = this.getView();
        if (!view) {
            return;
        }

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

    public onExportToCSV(): void {
        const model = this.getView()?.getModel("mh") as JSONModel;
        const allRows = model.getProperty("/allRows") || [];

        if (!allRows.length) {
            MessageToast.show("No data to export.");
            return;
        }

        const headers = ["Timestamp", "Company Name", "Device ID", "Model", "Status", "Part No", "Material"];
        const csvTitle = "Kontrolix Sap Machine data";

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += csvTitle + "\r\n\n"; // Add title and extra space
        csvContent += headers.join(",") + "\r\n";

        allRows.forEach((row: any) => {
            const rowData = headers.map(header => {
                // {console.log("this is my header",header)}
                let cell = row[header.replace(/ /g, "")] || "";
                // Escape commas and quotes
                cell = String(cell).includes(",") ? `"${cell}"` : cell;
                return cell;
            });
            csvContent += rowData.join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "machine_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    public onTimeFilterChange(oEvent: any): void {
        const sKey = oEvent.getParameter("selectedItem").getKey();
        const model = this.getView()?.getModel("mh") as JSONModel;
        model.setProperty("/timeFilter", sKey);
        model.setProperty("/currentPage", 1); // Reset to first page
        this.applyFiltersAndPagination();
    }

    public onPrevPage(): void {
        const model = this.getView()?.getModel("mh") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        if (currentPage > 1) {
            model.setProperty("/currentPage", currentPage - 1);
            this.applyPagination();
        }
    }

    public onNextPage(): void {
        const model = this.getView()?.getModel("mh") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        const totalPages = model.getProperty("/totalPages");
        if (currentPage < totalPages) {
            model.setProperty("/currentPage", currentPage + 1);
            this.applyPagination();
        }
    }

    private applyPagination(): void {
        this.applyFiltersAndPagination();
    }

    private applyFiltersAndPagination(): void {
        const model = this.getView()?.getModel("mh") as JSONModel;
        const allRows = model.getProperty("/allRows") || [];
        const timeFilter = model.getProperty("/timeFilter") || "all";
        const currentPage = model.getProperty("/currentPage") || 1;
        const pageSize = model.getProperty("/pageSize") || 10;

        // 1. Filter by time
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
                    now.setDate(now.getDate() - 1);
                    break;
                case "thisWeek":
                    startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                    break;
                case "last3Months":
                    startDate = new Date(now.setMonth(now.getMonth() - 3));
                    break;
                default:
                    startDate = new Date(0); // Should not happen
            }

            filteredRows = allRows.filter((row: any) => {
                const rowDate = new Date(row.Timestamp);
                if (timeFilter === "yesterday") {
                    return rowDate.getFullYear() === startDate.getFullYear() &&
                           rowDate.getMonth() === startDate.getMonth() &&
                           rowDate.getDate() === startDate.getDate();
                }
                return rowDate >= startDate;
            });
        }

        // 2. Pagination
        const totalRows = filteredRows.length;
        const totalPages = Math.ceil(totalRows / pageSize) || 1;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pagedRows = filteredRows.slice(start, end);

        model.setProperty("/rows", pagedRows);
        model.setProperty("/rowCount", totalRows);
        model.setProperty("/totalPages", totalPages);
    }

    private async loadMachineHistory(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) {
            return;
        }
        const model = view.getModel("mh") as JSONModel;

        const authToken = this.getAuthToken();
        if (!authToken) {
            model.setProperty("/connectionStatusText", "TOKEN MISSING");
            model.setProperty("/connectionStatusState", "Warning");
            if (showToast) {
                MessageToast.show("machineApiToken not found in browser storage");
            }
            return;
        }

        const basePath = "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/";
        let nextUrl = `${basePath}Machine?$orderby=Timestamp desc`;
        const allRows: Array<Record<string, any>> = [];

        try {
            // Follow OData paging if server provides nextLink
            for (let safety = 0; safety < 50 && nextUrl; safety++) {
                const res = await fetch(nextUrl, {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    }
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const payload = await res.json() as {
                    value?: Array<Record<string, any>>;
                    "@odata.nextLink"?: string;
                    "odata.nextLink"?: string;
                };

                allRows.push(...(payload.value || []));

                const maybeNext = payload["@odata.nextLink"] || payload["odata.nextLink"] || "";
                if (!maybeNext) {
                    nextUrl = "";
                    break;
                }

                // Handle both absolute and relative nextLink URLs
                if (maybeNext.startsWith("http")) {
                    // It's a full URL, but we should convert it to a relative path to avoid cross-origin issues if possible
                    try {
                        const parsed = new URL(maybeNext, window.location.origin);
                        nextUrl = parsed.pathname + parsed.search;
                    } catch (_e) {
                        nextUrl = maybeNext; // Fallback to absolute if parsing fails
                    }
                } else {
                    // It's a relative path, prepend the base path
                    nextUrl = basePath + maybeNext;
                }
            }

            model.setProperty("/allRows", allRows);
            this.applyPagination();
            
            model.setProperty("/connectionStatusText", "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());

            if (showToast) {
                MessageToast.show(`Loaded ${allRows.length} rows`);
            }
        } catch (error) {
            model.setProperty("/connectionStatusText", "OFFLINE");
            model.setProperty("/connectionStatusState", "Error");
            if (showToast) {
                MessageToast.show("Failed to load machine history");
            }
            // eslint-disable-next-line no-console
            console.error("Machine history API error:", error);
        }
    }

    private getAuthToken(): string {
        return (
            window.localStorage.getItem("machineApiToken") ||
            window.sessionStorage.getItem("machineApiToken") ||
            ""
        );
    }
}

