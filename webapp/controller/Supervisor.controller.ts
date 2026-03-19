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
                mode: "ADD", // ADD, EDIT, VIEW
                modalTitle: "Add New Supervisor",
                confirmButtonText: "Create Supervisor"
            },
            allEmployees: [],
            allResources: [],
            employeesList: [],
            resourcesList: [],
            selectedEmployees: [],
            selectedResources: [],
            allRows: [], // All data for searching
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            searchQuery: "",
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

        console.log("DEBUG: Updating dropdowns with all employees:", allEmployees.length, "employees");

        // For employees: Show ALL available employees (no filtering) so user can select any
        // For resources: Still filter to avoid duplicate assignments
        const assignedResourceIds = new Set<string>();

        allSupervisors.forEach((sup: any) => {
            if (currentSupervisorId && sup.SupervisorId === currentSupervisorId) return;

            try {
                const resJson = JSON.parse(sup.AssignedResources || "[]");
                resJson.forEach((r: any) => assignedResourceIds.add(r.resourceId));
            } catch (e) { /* ignore */ }
        });

        // Show ALL employees for selection
        const availableEmployees = allEmployees;
        // Filter only resources to avoid duplicates
        const availableResources = allResources.filter((res: any) => !assignedResourceIds.has(res.ResourceId));

        console.log("DEBUG: Available employees for dropdown:", availableEmployees.length);
        console.log("DEBUG: Available resources for dropdown:", availableResources.length);

        model.setProperty("/employeesList", availableEmployees);
        model.setProperty("/resourcesList", availableResources);
    }

    private async loadResourcesList(): Promise<void> {
        const token = this.getAuthToken();
        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Resource",
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
            const resources = payload.value || [];
            
            const model = this.getView()?.getModel("sup") as JSONModel;
            model.setProperty("/allResources", resources);

        } catch (e) {
            console.error("Failed to load resources for dropdown:", e);
        }
    }

    public onResourceSelectionChange(oEvent: any): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const selectedItems = oEvent.getSource().getSelectedItems();
        
        const assignedResources = selectedItems.map((item: any) => {
            const context = item.getBindingContext("sup");
            const data = context.getObject();
            return {
                resourceId: data.ResourceId,
                name: data.ResName
            };
        });

        model.setProperty("/form/AssignedResources", JSON.stringify(assignedResources));
    }

    private async loadEmployeesList(): Promise<void> {
        const token = this.getAuthToken();
        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User?$top=500",
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
            // Filter to only include actual employees (not supers or supervisors)
            const employees = payload.value?.filter((item) => (item.IsSuper === 0 && item.IsSupervisor === 0)) || [];
            
            console.log("DEBUG: All employees loaded for dropdown:", employees);
            
            const model = this.getView()?.getModel("sup") as JSONModel;
            model.setProperty("/allEmployees", employees);

        } catch (e) {
            console.error("Failed to load employees for dropdown:", e);
        }
    }

    public onEmployeeSelectionChange(oEvent: any): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const selectedItems = oEvent.getSource().getSelectedItems();
        
        const assignedEmployees = selectedItems.map((item: any) => {
            const context = item.getBindingContext("sup");
            const data = context.getObject();
            return {
                employeeId: data.UserId,
                firstName: data.FirstName
            };
        });

        model.setProperty("/form/AssignedEmployees", JSON.stringify(assignedEmployees));
    }



    public onOpenAddSupervisor(): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        model.setProperty("/ui/mode", "ADD");
        model.setProperty("/ui/modalTitle", "Add New Supervisor");
        model.setProperty("/ui/confirmButtonText", "Create Supervisor");
        model.setProperty("/selectedEmployees", []);
        model.setProperty("/selectedResources", []);
        model.setProperty("/form", {
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
        });
        
        this.updateDropdowns(); // Only show unassigned
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onViewSupervisor(oEvent: any): void {
        const context = oEvent.getSource().getBindingContext("sup");
        const data = context.getObject();
        const model = this.getView()?.getModel("sup") as JSONModel;

        model.setProperty("/ui/mode", "VIEW");
        model.setProperty("/ui/modalTitle", "Supervisor Details");
        model.setProperty("/ui/confirmButtonText", "");
        model.setProperty("/form", Object.assign({}, data));

        // Pre-fill selection from AssignedEmployees JSON string
        try {
            const assigned = JSON.parse(data.AssignedEmployees || "[]");
            const selectedKeys = assigned.map((emp: any) => emp.employeeId);
            model.setProperty("/selectedEmployees", selectedKeys);
        } catch {
            model.setProperty("/selectedEmployees", []);
        }

        // Pre-fill selection from AssignedResources JSON string
        try {
            const assignedRes = JSON.parse(data.AssignedResources || "[]");
            const selectedResKeys = assignedRes.map((res: any) => res.resourceId);
            model.setProperty("/selectedResources", selectedResKeys);
        } catch {
            model.setProperty("/selectedResources", []);
        }

        this.updateDropdowns(data.SupervisorId); // Show unassigned + current
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onEditSupervisor(oEvent: any): void {
        const context = oEvent.getSource().getBindingContext("sup");
        const data = context.getObject();
        const model = this.getView()?.getModel("sup") as JSONModel;

        model.setProperty("/ui/mode", "EDIT");
        model.setProperty("/ui/modalTitle", "Edit Supervisor");
        model.setProperty("/ui/confirmButtonText", "Update Supervisor");
        model.setProperty("/form", Object.assign({}, data));

        // Pre-fill selection from AssignedEmployees JSON string
        try {
            const assigned = JSON.parse(data.AssignedEmployees || "[]");
            const selectedKeys = assigned.map((emp: any) => emp.employeeId);
            model.setProperty("/selectedEmployees", selectedKeys);
        } catch {
            model.setProperty("/selectedEmployees", []);
        }

        // Pre-fill selection from AssignedResources JSON string
        try {
            const assignedRes = JSON.parse(data.AssignedResources || "[]");
            const selectedResKeys = assignedRes.map((res: any) => res.resourceId);
            model.setProperty("/selectedResources", selectedResKeys);
        } catch {
            model.setProperty("/selectedResources", []);
        }

        this.updateDropdowns(data.SupervisorId); // Show unassigned + current
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(true);
    }

    public async onDeleteSupervisor(oEvent: any): Promise<void> {
        const context = oEvent.getSource().getBindingContext("sup");
        const data = context.getObject();
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
                            {
                                method: "DELETE",
                                headers: {
                                    "Accept": "application/json",
                                    "Authorization": `Bearer ${token}`,
                                    "x-csrf-token": csrfToken
                                }
                            }
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

        if (mode === "ADD") {
            void this.onCreateSupervisor();
        } else if (mode === "EDIT") {
            void this.onUpdateSupervisor();
        }
    }

    public async onUpdateSupervisor(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("sup") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;

        const supervisorId = form.SupervisorId;
        if (!supervisorId) {
            MessageToast.show("Supervisor ID is missing");
            return;
        }

        const payload: Record<string, any> = {
            FirstName: String(form.FirstName || "").trim(),
            LastName: String(form.LastName || "").trim(),
            Phone: String(form.Phone || "").trim(),
            AssignedResources: String(form.AssignedResources || "[]"),
            AssignedEmployees: String(form.AssignedEmployees || "[]"),
            CpnyName: String(form.CpnyName || ""),
            Address: String(form.Address || ""),
            Gstin: String(form.Gstin || ""),
            BankName: String(form.BankName || ""),
            AccountNo: String(form.AccountNo || ""),
            IfscCode: String(form.IfscCode || "")
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

            MessageToast.show("Supervisor updated successfully!");
            this.onCloseAddSupervisor();
            await this.loadSupervisors();

        } catch (e) {
            console.error("Update supervisor failed:", e);
            MessageToast.show("Failed to update supervisor");
        }
    }

    public onCloseAddSupervisor(): void {
        (this.byId("addSupervisorOverlay") as VBox | undefined)?.setVisible(false);
    }

    public onRefreshSupervisors(): void {
        void this.loadSupervisors(true);
    }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter("query") || "";
        const model = this.getView()?.getModel("sup") as JSONModel;
        model.setProperty("/searchQuery", sQuery);
        model.setProperty("/currentPage", 1); // Reset to first page on search
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
        const totalPages = model.getProperty("/totalPages");
        if (currentPage < totalPages) {
            model.setProperty("/currentPage", currentPage + 1);
            this.applyFiltersAndPagination();
        }
    }

    private applyFiltersAndPagination(): void {
        const model = this.getView()?.getModel("sup") as JSONModel;
        const allRows = model.getProperty("/allRows") || [];
        const searchQuery = (model.getProperty("/searchQuery") || "").toLowerCase();
        const currentPage = model.getProperty("/currentPage") || 1;
        const pageSize = model.getProperty("/pageSize") || 10;

        // 1. Filter
        let filteredRows = allRows;
        if (searchQuery) {
            filteredRows = allRows.filter((row: any) => {
                return (row.FirstName || "").toLowerCase().includes(searchQuery) ||
                       (row.LastName || "").toLowerCase().includes(searchQuery) ||
                       (row.Email || "").toLowerCase().includes(searchQuery) ||
                       (row.SupervisorId || "").toLowerCase().includes(searchQuery) ||
                       (row.Phone || "").toLowerCase().includes(searchQuery);
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

    public async onCreateSupervisor(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("sup") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;

        const firstName = String(form.FirstName || "").trim();
        const lastName = String(form.LastName || "").trim();
        const email = String(form.Email || "").trim();
        const phone = String(form.Phone || "").trim();
        const password = String(form.Password || "").trim();

        if (!firstName || !email || !phone || !password) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        const payload: Record<string, any> = {
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            Phone: phone,
            Password: password,
            IsSuper: 0,
            IsSupervisor: 1,
            IsVerified: 1,
            IsActive: 1,
            AssignedResources: String(form.AssignedResources || "[]"),
            AssignedEmployees: String(form.AssignedEmployees || "[]"),
            CpnyName: String(form.CpnyName || ""),
            Address: String(form.Address || ""),
            Gstin: String(form.Gstin || ""),
            BankName: String(form.BankName || ""),
            AccountNo: String(form.AccountNo || ""),
            IfscCode: String(form.IfscCode || "")
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

            MessageToast.show("Supervisor created successfully!");

            model.setProperty("/form", {
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
            });

            this.onCloseAddSupervisor();
            await this.loadSupervisors();

        } catch (e) {
            console.error("Create supervisor failed:", e);
            MessageToast.show("Failed to create supervisor");
        }
    }

    private async loadSupervisors(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("sup") as JSONModel;
        const token = this.getAuthToken();

        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zrsrc_sb/srvd_a2x/sap/zrsrc_sd/0001/Supervisor",
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

            model.setProperty("/allRows", rows);
            this.applyFiltersAndPagination(); // This sets /rows, /rowCount, /totalPages

            model.setProperty("/connectionStatusText", "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());

            this.updateDropdowns();

            if (showToast) MessageToast.show(`Loaded ${rows.length} supervisors`);

        } catch (e) {
            model.setProperty("/connectionStatusText", "OFFLINE");
            model.setProperty("/connectionStatusState", "Error");
            if (showToast) MessageToast.show("Failed to load supervisors");
            console.error("Supervisors API error:", e);
        }
    }




}