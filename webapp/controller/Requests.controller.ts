import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";

/**
 * @namespace ashu.ashu.controller
 */
export default class Requests extends Controller {

    private _addRequestDialog: Dialog | null = null;

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const requestModel = new JSONModel({
            allRows: [],     // Unfiltered data
            rows: [],        // Displayed data
            rowCount:        0,
            pendingCount:    0,
            supApprovedCount: 0,
            approvedCount:   0,
            rejectedCount:   0,
            connectionStatusText:  "OFFLINE",
            connectionStatusState: "Error",
            lastUpdated: "-",
            searchQuery: "",
            selectedStatus: "allStatus",
            // Pagination
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            // Role & Form
            isEmployee: false,
            isAdmin: false,
            isSupervisor: false,
            form: {
                ReqType: "tea",
                Reason: ""
            }
        });

        // Role check
        const userStr = window.localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : {};
        const role = String(user.Role || user.role || "").toUpperCase();
        requestModel.setProperty("/isEmployee", role === "EMPLOYEE");
        requestModel.setProperty("/isAdmin", role === "ADMIN" || role === "SUPER ADMIN");
        requestModel.setProperty("/isSupervisor", role === "SUPERVISOR");

        view.setModel(requestModel, "req");
        void this.loadRequests();
    }

    public onSideItemPress(oEvent: any): void {
        const item  = oEvent.getParameter("listItem") as any;
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
        (this.getOwnerComponent() as UIComponent).getRouter().navTo("login");
    }

    public onSignOut(): void { this.onLogout(); }

    public onRefreshRequests(): void { void this.loadRequests(true); }

    public async onOpenAddRequest(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        if (!this._addRequestDialog) {
            this._addRequestDialog = await Fragment.load({
                id: view.getId(),
                name: "ashu.ashu.view.AddRequestDialog",
                controller: this
            }) as Dialog;
            view.addDependent(this._addRequestDialog);
        }

        const model = view.getModel("req") as JSONModel;
        model.setProperty("/form", {
            ReqType: "tea",
            Reason: ""
        });

        this._addRequestDialog.open();
    }

    public onCloseAddRequest(): void {
        this._addRequestDialog?.close();
    }

    public async onSubmitRequest(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("req") as JSONModel;
        const form = model.getProperty("/form");

        if (!form.Reason) {
            MessageToast.show("Please provide a reason");
            return;
        }

        const userStr = window.localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : {};
        const supervisorsStr = window.localStorage.getItem("supervisors");
        const supervisor = supervisorsStr ? JSON.parse(supervisorsStr) : {};

        const token = this.getAuthToken();
        const csrfToken = await this.getCSRFToken();

        const supervisorName = (String(supervisor.firstName || "") + " " + String(supervisor.lastName || "")).trim();
        const supervisorEmail = String(supervisor.email || "");
        const supervisorId = String(supervisor.supervisorId || "");

        const newRequest = {
            RequestId: "REQ" + Date.now(),
            EmployeeId: String(user.EmployeeId || user.userId || ""),
            EmployeeName: (String(user.firstName || user.Name || user.name || "") + " " + String(user.lastName || "")).trim() || String(user.email || user.Email || ""),
            EmployeeEmail: String(user.Email || user.email || ""),
            SupervisorId: supervisorId,
            SupervisorName: supervisorName,
            SupervisorEmail: supervisorEmail,
            ReqType: form.ReqType,
            Reason: form.Reason,
            Status: "pending",
            SupApprovalStatus: "pending",
            AdminApprovalStatus: "pending",
            CreatedAt: new Date().toISOString()
        };

        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zrequest_sb/srvd_a2x/sap/zrequest_sd/0001/Request",
                {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "x-csrf-token": csrfToken
                    },
                    body: JSON.stringify(newRequest)
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            MessageToast.show("Request submitted successfully!");
            this.onCloseAddRequest();
            await this.loadRequests();

        } catch (e) {
            console.error("Submission failed:", e);
            MessageToast.show("Failed to submit request");
        }
    }

    public onSearch(oEvent: any): void {
        const query = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
        const model = this.getView()?.getModel("req") as JSONModel;
        model.setProperty("/searchQuery", query);
        model.setProperty("/currentPage", 1); // Reset to first page
        this.applyFilters();
    }

    public onStatusFilterChange(oEvent: any): void {
        const selectedKey = oEvent.getSource().getSelectedKey();
        const model = this.getView()?.getModel("req") as JSONModel;
        model.setProperty("/selectedStatus", selectedKey);
        model.setProperty("/currentPage", 1); // Reset to first page
        this.applyFilters();
    }

    public onPreviousPage(): void {
        const model = this.getView()?.getModel("req") as JSONModel;
        const current = model.getProperty("/currentPage") as number;
        if (current > 1) {
            model.setProperty("/currentPage", current - 1);
            this.applyFilters();
        }
    }

    public onNextPage(): void {
        const model = this.getView()?.getModel("req") as JSONModel;
        const current = model.getProperty("/currentPage") as number;
        const total = model.getProperty("/totalPages") as number;
        if (current < total) {
            model.setProperty("/currentPage", current + 1);
            this.applyFilters();
        }
    }

    private applyFilters(): void {
        const model = this.getView()?.getModel("req") as JSONModel;
        if (!model) return;

        const allRows = model.getProperty("/allRows") as any[];
        const query = (model.getProperty("/searchQuery") || "").toLowerCase();
        const status = model.getProperty("/selectedStatus");
        const currentPage = model.getProperty("/currentPage") as number;
        const pageSize = model.getProperty("/pageSize") as number;

        let filtered = allRows;

        // 1. Search Filter
        if (query) {
            filtered = allRows.filter(r => 
                String(r.EmployeeName  || "").toLowerCase().includes(query) ||
                String(r.EmployeeEmail || "").toLowerCase().includes(query) ||
                String(r.Reason        || "").toLowerCase().includes(query) ||
                String(r.ReqType       || "").toLowerCase().includes(query)
            );
        }

        // 2. Status Filter
        if (status && status !== "allStatus") {
            filtered = filtered.filter(r => String(r.AdminApprovalStatus || "").toLowerCase() === status.toLowerCase());
        }

        // 3. Pagination slicing
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedRows = filtered.slice(startIndex, endIndex);

        model.setProperty("/rows", paginatedRows);
        model.setProperty("/totalPages", totalPages);
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
        const token     = this.getAuthToken();
        const csrfToken = await this.getCSRFToken();
        const model = this.getView()?.getModel("req") as JSONModel;
        const isAdmin = model.getProperty("/isAdmin") as boolean;
        const isSupervisor = model.getProperty("/isSupervisor") as boolean;

        const payload: Record<string, any> = {};

        if (isAdmin) {
            payload.AdminApprovalStatus = status;
            payload.AdminApprovedAt = new Date().toISOString();
            // If Admin approves, it's final
            payload.Status = status;
        } else if (isSupervisor) {
            payload.SupApprovalStatus = status;
            payload.SupApprovedAt = new Date().toISOString();
            // If Supervisor rejects, it's final (optional, based on requirements)
            // But if Admin approves, Supervisor approval is not needed
            if (status === "rejected") {
                payload.Status = "rejected";
            }
        }

        try {
            const res = await fetch(
                `/sap/opu/odata4/sap/zrequest_sb/srvd_a2x/sap/zrequest_sd/0001/Request('${requestId}')`,
                {
                    method: "PATCH",
                    headers: {
                        "Accept":        "application/json",
                        "Content-Type":  "application/json",
                        "Authorization": `Bearer ${token}`,
                        "x-csrf-token":  csrfToken
                    },
                    body: JSON.stringify(payload)
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
                        "Accept":        "application/json",
                        "Authorization": `Bearer ${token}`,
                        "X-Requested-With": "XMLHttpRequest"
                    }
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const payload = await res.json() as { value?: Array<Record<string, any>> };
            const rows    = payload.value || [];

            const pendingCount     = rows.filter(r => String(r.AdminApprovalStatus       || "").toLowerCase() === "pending" ).length;
            const supApprovedCount = rows.filter(r => String(r.SupervisorApprovalStatus  || "").toLowerCase() === "approved").length;
            const approvedCount    = rows.filter(r => String(r.AdminApprovalStatus       || "").toLowerCase() === "approved").length;
            const rejectedCount    = rows.filter(r => String(r.AdminApprovalStatus       || "").toLowerCase() === "rejected").length;

            model.setProperty("/allRows",             rows);
            model.setProperty("/rowCount",            rows.length);
            model.setProperty("/pendingCount",        pendingCount);
            model.setProperty("/supApprovedCount",    supApprovedCount);
            model.setProperty("/approvedCount",       approvedCount);
            model.setProperty("/rejectedCount",       rejectedCount);
            model.setProperty("/connectionStatusText",  "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated",           new Date().toLocaleString());

            this.applyFilters(); // Apply existing search/filter on newly loaded data

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
                        "x-csrf-token":  "fetch",
                        "Authorization": `Bearer ${token}`,
                        "X-Requested-With": "XMLHttpRequest"
                    }
                }
            );
            return res.headers.get("x-csrf-token") || "";
        } catch {
            return "";
        }
    }
}