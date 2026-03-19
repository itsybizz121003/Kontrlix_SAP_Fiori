import BaseController from "./BaseController";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import VBox from "sap/m/VBox";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ashu.ashu.controller
 */
export default class Supervisor extends BaseController {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const supModel = new JSONModel({
            rows: [],
            rowCount: 0,
            connectionStatusText: "OFFLINE",
            connectionStatusState: "Error",
            lastUpdated: "-",
            ui: {
                mode: "ADD",
                modalTitle: "Add New Supervisor",
                confirmButtonText: "Create Supervisor"
            },
            allEmployees: [],
            allResources: [],
            employeesList: [],
            resourcesList: [],
            selectedEmployees: [],
            selectedResources: [],
            allRows: [],
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            searchQuery: "",
            isAdmin: false, // New property for UI visibility
            form: {
                SupervisorId: "",
                FirstName: "",
                LastName: "",
                Email: "",
                Phone: "",
                Password: "",
                IsSuper: 0,
                IsSupervisor: 1,
                IsVerified: 1,
                IsActive: 1,
                AssignedResources: "[]",
                AssignedEmployees: "[]",
                CpnyName: "",
                Address: "",
                Gstin: "",
                BankName: "",
                AccountNo: "",
                IfscCode: ""
            }
        });

        view.setModel(supModel, "sup");

        // Role check for UI visibility
        const userStr = window.localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : {};
        const role = String(user.Role || user.role || "").toUpperCase();
        supModel.setProperty("/isAdmin", role === "ADMIN" || role === "SUPER ADMIN");

        void this.initData();
    }

    private async initData(): Promise<void> {
        await Promise.all([
            this.loadSupervisors(),
            this.loadEmployeesList(),
            this.loadResourcesList()
        ]);
        this.updateDropdowns();
    }

    public formatAssignedEmployees(sJson: string): string {
        if (!sJson || sJson === "[]") return "";
        try {
            const aEmployees = JSON.parse(sJson);
            return aEmployees.map((emp: any) => emp.firstName).join(", ");
        } catch (e) {
            return sJson;
        }
    }

    private updateDropdowns(currentSupervisorId?: string): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const allEmployees = model.getProperty("/allEmployees") || [];
        const allResources = model.getProperty("/allResources") || [];
        const allSupervisors = model.getProperty("/rows") || [];

        const assignedResourceIds = new Set<string>();
        allSupervisors.forEach((sup: any) => {
            if (currentSupervisorId && sup.SupervisorId === currentSupervisorId) return;
            try {
                const resJson = JSON.parse(sup.AssignedResources || "[]");
                resJson.forEach((r: any) => assignedResourceIds.add(r.resourceId));
            } catch (e) { /* ignore */ }
        });

        const availableResources = allResources.filter((res: any) => !assignedResourceIds.has(res.ResourceId));

        model.setProperty("/employeesList", allEmployees);
        model.setProperty("/resourcesList", availableResources);
    }

    private async loadResourcesList(): Promise<void> {
        const token = this.getAuthToken();
        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Resource",
                { method: "GET", headers: { "Accept": "application/json", "Authorization": `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json() as { value?: Array<Record<string, any>> };
            const model = this.getView()?.getModel("sup") as JSONModel;
            model.setProperty("/allResources", payload.value || []);
        } catch (e) {
            console.error("Failed to load resources:", e);
        }
    }

    public onResourceSelectionChange(oEvent: any): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const selectedItems = oEvent.getSource().getSelectedItems();
        const assignedResources = selectedItems.map((item: any) => {
            const data = item.getBindingContext("sup").getObject();
            return { resourceId: data.ResourceId, name: data.ResName };
        });
        model.setProperty("/form/AssignedResources", JSON.stringify(assignedResources));
    }

    private async loadEmployeesList(): Promise<void> {
        const token = this.getAuthToken();
        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User?$top=500",
                { method: "GET", headers: { "Accept": "application/json", "Authorization": `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = await res.json() as { value?: Array<Record<string, any>> };
            const employees = payload.value?.filter(item => item.IsSuper === 0 && item.IsSupervisor === 0) || [];
            const model = this.getView()?.getModel("sup") as JSONModel;
            model.setProperty("/allEmployees", employees);
        } catch (e) {
            console.error("Failed to load employees:", e);
        }
    }

    public onEmployeeSelectionChange(oEvent: any): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const selectedItems = oEvent.getSource().getSelectedItems();
        const assignedEmployees = selectedItems.map((item: any) => {
            const data = item.getBindingContext("sup").getObject();
            return { employeeId: data.UserId, firstName: data.FirstName };
        });
        model.setProperty("/form/AssignedEmployees", JSON.stringify(assignedEmployees));
    }

    // ── NAYA: Assigned employees ki supervisor_id update karo ────────────────
    // Jab bhi supervisor create/update hota hai, assigned employees ki
    // zkontrolix_user table mein supervisor_id set ho jaati hai automatically
    private async updateEmployeesSupervisorId(
        supervisorId: string,
        assignedEmployeesJson: string
    ): Promise<void> {
        const token = this.getAuthToken();
        const csrfToken = await this.getCSRFToken();

        let employees: Array<{ employeeId: string }> = [];
        try {
            employees = JSON.parse(assignedEmployeesJson || "[]");
        } catch {
            return;
        }

        if (employees.length === 0) return;

        // Har assigned employee ki supervisor_id PATCH karo
        const updatePromises = employees.map(async (emp) => {
            if (!emp.employeeId) return;
            try {
                await fetch(
                    `/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User('${emp.employeeId}')`,
                    {
                        method: "PATCH",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`,
                            "x-csrf-token": csrfToken
                        },
                        body: JSON.stringify({ SupervisorId: supervisorId })
                    }
                );
            } catch (e) {
                console.error(`Failed to update supervisor_id for employee ${emp.employeeId}:`, e);
            }
        });

        await Promise.all(updatePromises);
        console.log(`supervisor_id '${supervisorId}' set for ${employees.length} employees`);
    }
    // ────────────────────────────────────────────────────────────────────────

    public onOpenAddSupervisor(): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        model.setProperty("/ui/mode", "ADD");
        model.setProperty("/ui/modalTitle", "Add New Supervisor");
        model.setProperty("/ui/confirmButtonText", "Create Supervisor");
        model.setProperty("/selectedEmployees", []);
        model.setProperty("/selectedResources", []);
        model.setProperty("/form", {
            SupervisorId: "", FirstName: "", LastName: "", Email: "",
            Phone: "", Password: "", IsSuper: 0, IsSupervisor: 1,
            IsVerified: 1, IsActive: 1, AssignedResources: "[]",
            AssignedEmployees: "[]", CpnyName: "", Address: "",
            Gstin: "", BankName: "", AccountNo: "", IfscCode: ""
        });
        this.updateDropdowns();
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onViewSupervisor(oEvent: any): void {
        const data = oEvent.getSource().getBindingContext("sup").getObject();
        const model = this.getView()?.getModel("sup") as JSONModel;
        model.setProperty("/ui/mode", "VIEW");
        model.setProperty("/ui/modalTitle", "Supervisor Details");
        model.setProperty("/ui/confirmButtonText", "");
        model.setProperty("/form", Object.assign({}, data));
        try {
            const assigned = JSON.parse(data.AssignedEmployees || "[]");
            model.setProperty("/selectedEmployees", assigned.map((e: any) => e.employeeId));
        } catch { model.setProperty("/selectedEmployees", []); }
        try {
            const assignedRes = JSON.parse(data.AssignedResources || "[]");
            model.setProperty("/selectedResources", assignedRes.map((r: any) => r.resourceId));
        } catch { model.setProperty("/selectedResources", []); }
        this.updateDropdowns(data.SupervisorId);
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onEditSupervisor(oEvent: any): void {
        const data = oEvent.getSource().getBindingContext("sup").getObject();
        const model = this.getView()?.getModel("sup") as JSONModel;
        model.setProperty("/ui/mode", "EDIT");
        model.setProperty("/ui/modalTitle", "Edit Supervisor");
        model.setProperty("/ui/confirmButtonText", "Update Supervisor");
        model.setProperty("/form", Object.assign({}, data));
        try {
            const assigned = JSON.parse(data.AssignedEmployees || "[]");
            model.setProperty("/selectedEmployees", assigned.map((e: any) => e.employeeId));
        } catch { model.setProperty("/selectedEmployees", []); }
        try {
            const assignedRes = JSON.parse(data.AssignedResources || "[]");
            model.setProperty("/selectedResources", assignedRes.map((r: any) => r.resourceId));
        } catch { model.setProperty("/selectedResources", []); }
        this.updateDropdowns(data.SupervisorId);
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(true);
    }

    public async onDeleteSupervisor(oEvent: any): Promise<void> {
        const data = oEvent.getSource().getBindingContext("sup").getObject();
        const supervisorId = data.SupervisorId;
        if (!supervisorId) return;

        MessageBox.confirm(`Are you sure you want to delete this Supervisor (${supervisorId})?`, {
            title: "Confirm Deletion",
            onClose: async (sAction: string | null) => {
                if (sAction === MessageBox.Action.OK) {
                    try {
                        const token = this.getAuthToken();
                        const csrfToken = await this.getCSRFToken();
                        const res = await fetch(
                            `/sap/opu/odata4/sap/zrsrc_sb/srvd_a2x/sap/zrsrc_sd/0001/Supervisor(SupervisorId='${supervisorId}')`,
                            { method: "DELETE", headers: { "Accept": "application/json", "Authorization": `Bearer ${token}`, "x-csrf-token": csrfToken } }
                        );
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        MessageToast.show("Supervisor deleted successfully!");
                        await this.loadSupervisors();
                    } catch (e) {
                        console.error("Delete supervisor failed:", e);
                        MessageToast.show("Failed to delete supervisor");
                    }
                }
            }
        });
    }

    public onConfirmAction(): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const mode = model.getProperty("/ui/mode");
        if (mode === "ADD") void this.onCreateSupervisor();
        else if (mode === "EDIT") void this.onUpdateSupervisor();
    }

    public async onUpdateSupervisor(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("sup") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;
        const supervisorId = form.SupervisorId;

        if (!supervisorId) { MessageToast.show("Supervisor ID is missing"); return; }

        const assignedEmployeesJson = String(form.AssignedEmployees || "[]");

        const payload: Record<string, any> = {
            FirstName:         String(form.FirstName || "").trim(),
            LastName:          String(form.LastName  || "").trim(),
            Phone:             String(form.Phone     || "").trim(),
            AssignedResources: String(form.AssignedResources || "[]"),
            AssignedEmployees: assignedEmployeesJson,
            CpnyName:  String(form.CpnyName  || ""),
            Address:   String(form.Address   || ""),
            Gstin:     String(form.Gstin     || ""),
            BankName:  String(form.BankName  || ""),
            AccountNo: String(form.AccountNo || ""),
            IfscCode:  String(form.IfscCode  || "")
        };

        try {
            const token = this.getAuthToken();
            const csrfToken = await this.getCSRFToken();

            const res = await fetch(
                `/sap/opu/odata4/sap/zrsrc_sb/srvd_a2x/sap/zrsrc_sd/0001/Supervisor(SupervisorId='${supervisorId}')`,
                {
                    method: "PATCH",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "x-csrf-token": csrfToken
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // ── Assigned employees ki supervisor_id automatically update karo ─
            await this.updateEmployeesSupervisorId(supervisorId, assignedEmployeesJson);

            MessageToast.show("Supervisor updated successfully!");
            this.onCloseAddSupervisor();
            await this.loadSupervisors();

        } catch (e) {
            console.error("Update supervisor failed:", e);
            MessageToast.show("Failed to update supervisor");
        }
    }

    public async onCreateSupervisor(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("sup") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;

        const firstName = String(form.FirstName || "").trim();
        const lastName  = String(form.LastName  || "").trim();
        const email     = String(form.Email     || "").trim();
        const phone     = String(form.Phone     || "").trim();
        const password  = String(form.Password  || "").trim();

        if (!firstName || !email || !phone || !password) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        const assignedEmployeesJson = String(form.AssignedEmployees || "[]");

        const payload: Record<string, any> = {
            FirstName:         firstName,
            LastName:          lastName,
            Email:             email,
            Phone:             phone,
            Password:          password,
            IsSuper:           0,
            IsSupervisor:      1,
            IsVerified:        1,
            IsActive:          1,
            AssignedResources: String(form.AssignedResources || "[]"),
            AssignedEmployees: assignedEmployeesJson,
            CpnyName:  String(form.CpnyName  || ""),
            Address:   String(form.Address   || ""),
            Gstin:     String(form.Gstin     || ""),
            BankName:  String(form.BankName  || ""),
            AccountNo: String(form.AccountNo || ""),
            IfscCode:  String(form.IfscCode  || "")
        };

        if (String(form.SupervisorId || "").trim()) {
            payload["SupervisorId"] = String(form.SupervisorId).trim();
        }

        try {
            const token = this.getAuthToken();
            const csrfToken = await this.getCSRFToken();

            const res = await fetch(
                "/sap/opu/odata4/sap/zrsrc_sb/srvd_a2x/sap/zrsrc_sd/0001/Supervisor",
                {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "x-csrf-token": csrfToken
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // ── Newly created supervisor ka ID response se uthao ─────────────
            const created = await res.json() as Record<string, any>;
            const newSupervisorId = String(
                created.SupervisorId || form.SupervisorId || ""
            );

            // ── Assigned employees ki supervisor_id automatically update karo ─
            if (newSupervisorId) {
                await this.updateEmployeesSupervisorId(newSupervisorId, assignedEmployeesJson);
            }

            MessageToast.show("Supervisor created successfully!");
            model.setProperty("/form", {
                SupervisorId: "", FirstName: "", LastName: "", Email: "",
                Phone: "", Password: "", IsSuper: 0, IsSupervisor: 1,
                IsVerified: 1, IsActive: 1, AssignedResources: "[]",
                AssignedEmployees: "[]", CpnyName: "", Address: "",
                Gstin: "", BankName: "", AccountNo: "", IfscCode: ""
            });
            this.onCloseAddSupervisor();
            await this.loadSupervisors();

        } catch (e) {
            console.error("Create supervisor failed:", e);
            MessageToast.show("Failed to create supervisor");
        }
    }

    public onCloseAddSupervisor(): void {
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(false);
    }

    public onRefreshSupervisors(): void { void this.loadSupervisors(true); }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter("query") || "";
        const model = this.getView()?.getModel("sup") as JSONModel;
        model.setProperty("/searchQuery", sQuery);
        model.setProperty("/currentPage", 1);
        this.applyFiltersAndPagination();
    }

    public onPrevPage(): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        if (currentPage > 1) {
            model.setProperty("/currentPage", currentPage - 1);
            this.applyFiltersAndPagination();
        }
    }

    public onNextPage(): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        const totalPages  = model.getProperty("/totalPages");
        if (currentPage < totalPages) {
            model.setProperty("/currentPage", currentPage + 1);
            this.applyFiltersAndPagination();
        }
    }

    private applyFiltersAndPagination(): void {
        const model       = this.getView()?.getModel("sup") as JSONModel;
        const allRows     = model.getProperty("/allRows") || [];
        const searchQuery = (model.getProperty("/searchQuery") || "").toLowerCase();
        const currentPage = model.getProperty("/currentPage") || 1;
        const pageSize    = model.getProperty("/pageSize") || 10;

        let filteredRows = allRows;
        if (searchQuery) {
            filteredRows = allRows.filter((row: any) =>
                (row.FirstName    || "").toLowerCase().includes(searchQuery) ||
                (row.LastName     || "").toLowerCase().includes(searchQuery) ||
                (row.Email        || "").toLowerCase().includes(searchQuery) ||
                (row.SupervisorId || "").toLowerCase().includes(searchQuery) ||
                (row.Phone        || "").toLowerCase().includes(searchQuery)
            );
        }

        const totalRows  = filteredRows.length;
        const totalPages = Math.ceil(totalRows / pageSize) || 1;
        const start = (currentPage - 1) * pageSize;
        const pagedRows = filteredRows.slice(start, start + pageSize);

        model.setProperty("/rows",       pagedRows);
        model.setProperty("/rowCount",   totalRows);
        model.setProperty("/totalPages", totalPages);
    }

    private async loadSupervisors(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("sup") as JSONModel;
        const token = this.getAuthToken();

        const userStr = window.localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) as Record<string, any> : {};
        const role = String(user.Role || user.role || "").toUpperCase();
        const userId = String(user.SupervisorId || user.EmployeeId || user.userId || "");

        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zrsrc_sb/srvd_a2x/sap/zrsrc_sd/0001/Supervisor",
                { method: "GET", headers: { "Accept": "application/json", "Authorization": `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const payload = await res.json() as { value?: Array<Record<string, any>> };
            let rows = payload.value || [];

            // Role-based filtering
            if (role === "SUPERVISOR") {
                // Supervisor only sees themselves
                rows = rows.filter((r: any) => String(r.SupervisorId) === userId);
            } else if (role === "EMPLOYEE") {
                // Employee only sees their assigned supervisor
                rows = rows.filter((r: any) => {
                    try {
                        const assignedEmps = JSON.parse(r.AssignedEmployees || "[]");
                        return assignedEmps.some((emp: any) => String(emp.employeeId) === userId);
                    } catch (e) { return false; }
                });
            }

            model.setProperty("/allRows", rows);
            this.applyFiltersAndPagination();
            model.setProperty("/connectionStatusText",  "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());
            this.updateDropdowns();

            if (showToast) MessageToast.show(`Loaded ${rows.length} supervisors`);

        } catch (e) {
            model.setProperty("/connectionStatusText",  "OFFLINE");
            model.setProperty("/connectionStatusState", "Error");
            if (showToast) MessageToast.show("Failed to load supervisors");
            console.error("Supervisors API error:", e);
        }
    }
}