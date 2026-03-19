import BaseController from "./BaseController";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import VBox from "sap/m/VBox";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ashu.ashu.controller
 */
export default class Employees extends BaseController {

    public onInit(): void {
        const view = this.getView();
        if (!view) {
            return;
        }

        const employeesModel = new JSONModel({
            allRows: [], // All data for searching
            rows: [], // Paged rows
            rowCount: 0,
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            searchQuery: "",
            connectionStatusText: "OFFLINE",
            connectionStatusState: "Error",
            lastUpdated: "-",
            ui: {
                mode: "ADD", // ADD, EDIT, VIEW
                modalTitle: "Add New Employee",
                confirmButtonText: "Create Employee"
            },
            form: {
                UserId: "",
                FirstName: "",
                LastName: "",
                Email: "",
                Phone: "",
                Password: "",
                ConfirmPassword: "",
                Role: "employee",
                IsSuper: 0,
                IsSupervisor: 0,
                IsActive: 1
            }
        });

        view.setModel(employeesModel, "emp");
        void this.loadEmployees();
    }

  

    public onOpenAddEmployee(): void {
        const model = this.getView()?.getModel("emp") as JSONModel;
        model.setProperty("/ui/mode", "ADD");
        model.setProperty("/ui/modalTitle", "Add New Employee");
        model.setProperty("/ui/confirmButtonText", "Create Employee");
        model.setProperty("/form", {
            UserId: "",
            FirstName: "",
            LastName: "",
            Email: "",
            Phone: "",
            Password: "",
            ConfirmPassword: "",
            Role: "employee",
            IsSuper: 0,
            IsSupervisor: 0,
            IsActive: 1
        });
        (this.byId("addEmployeeOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onViewEmployee(oEvent: any): void {
        const context = oEvent.getSource().getBindingContext("emp");
        const data = context.getObject();
        const model = this.getView()?.getModel("emp") as JSONModel;

        model.setProperty("/ui/mode", "VIEW");
        model.setProperty("/ui/modalTitle", "Employee Details");
        model.setProperty("/ui/confirmButtonText", "");
        model.setProperty("/form", Object.assign({}, data));

        (this.byId("addEmployeeOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onEditEmployee(oEvent: any): void {
        const context = oEvent.getSource().getBindingContext("emp");
        const data = context.getObject();
        const model = this.getView()?.getModel("emp") as JSONModel;

        model.setProperty("/ui/mode", "EDIT");
        model.setProperty("/ui/modalTitle", "Edit Employee");
        model.setProperty("/ui/confirmButtonText", "Update Employee");
        model.setProperty("/form", Object.assign({}, data));

        (this.byId("addEmployeeOverlay") as VBox | undefined)?.setVisible(true);
    }

    public async onDeleteEmployee(oEvent: any): Promise<void> {
        const context = oEvent.getSource().getBindingContext("emp");
        const data = context.getObject();
        const userId = data.UserId;

        if (!userId) return;

        MessageBox.confirm(`Are you sure you want to delete this Employee (${userId})?`, {
            title: "Confirm Deletion",
            onClose: async (sAction: string | null) => {
                if (sAction === MessageBox.Action.OK) {
                    try {
                        const token = this.getAuthToken();
                        const csrfToken = await this.getCSRFToken();

                        const res = await fetch(
                            `/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User(UserId='${userId}')`,
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

                        MessageToast.show("Employee deleted successfully!");
                        await this.loadEmployees();

                    } catch (e) {
                        console.error("Delete employee failed:", e);
                        MessageToast.show("Failed to delete employee");
                    }
                }
            }
        });
    }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter("query") || "";
        const model = this.getView()?.getModel("emp") as JSONModel;
        model.setProperty("/searchQuery", sQuery);
        model.setProperty("/currentPage", 1);
        this.applyFiltersAndPagination();
    }

    public onPrevPage(): void {
        const model = this.getView()?.getModel("emp") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        if (currentPage > 1) {
            model.setProperty("/currentPage", currentPage - 1);
            this.applyFiltersAndPagination();
        }
    }

    public onNextPage(): void {
        const model = this.getView()?.getModel("emp") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        const totalPages = model.getProperty("/totalPages");
        if (currentPage < totalPages) {
            model.setProperty("/currentPage", currentPage + 1);
            this.applyFiltersAndPagination();
        }
    }

    private applyFiltersAndPagination(): void {
        const model = this.getView()?.getModel("emp") as JSONModel;
        const allRows = model.getProperty("/allRows") || [];
        const searchQuery = (model.getProperty("/searchQuery") || "").toLowerCase();
        const currentPage = model.getProperty("/currentPage") || 1;
        const pageSize = model.getProperty("/pageSize") || 10;

        let filteredRows = allRows;
        if (searchQuery) {
            filteredRows = allRows.filter((row: any) => {
                const role = row.IsSuper === 1 ? 'super admin' : (row.IsSupervisor === 1 ? 'supervisor' : 'employee');
                return (row.FirstName || "").toLowerCase().includes(searchQuery) ||
                       (row.LastName || "").toLowerCase().includes(searchQuery) ||
                       (row.Email || "").toLowerCase().includes(searchQuery) ||
                       (row.UserId || "").toLowerCase().includes(searchQuery) ||
                       (row.Phone || "").toLowerCase().includes(searchQuery) ||
                       role.includes(searchQuery);
            });
        }

        const totalRows = filteredRows.length;
        const totalPages = Math.ceil(totalRows / pageSize) || 1;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pagedRows = filteredRows.slice(start, end);

        model.setProperty("/rows", pagedRows);
        model.setProperty("/rowCount", totalRows);
        model.setProperty("/totalPages", totalPages);
    }

    public onConfirmAction(): void {
        const model = this.getView()?.getModel("emp") as JSONModel;
        const mode = model.getProperty("/ui/mode");
        if (mode === "ADD") void this.onCreateEmployee();
        else if (mode === "EDIT") void this.onUpdateEmployee();
    }

    public async onUpdateEmployee(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("emp") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;
        const userId = form.UserId;

        if (!userId) {
            MessageToast.show("User ID is missing");
            return;
        }

        const payload = {
            FirstName: String(form.FirstName || "").trim(),
            LastName: String(form.LastName || "").trim(),
            Phone: String(form.Phone || "").trim(),
            IsActive: Number(form.IsActive) === 1 ? 1 : 0
        };

        try {
            const token = this.getAuthToken();
            const csrfToken = await this.getCSRFToken();

            const res = await fetch(
                `/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User(UserId='${userId}')`,
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

            MessageToast.show("Employee updated successfully");
            this.onCloseAddEmployee();
            await this.loadEmployees();
        } catch (e) {
            console.error("Update employee failed:", e);
            MessageToast.show("Failed to update employee");
        }
    }

    public onStatusChange(oEvent: any): void {
        const model = this.getView()?.getModel("emp") as JSONModel;
        const bState = oEvent.getParameter("state");
        model.setProperty("/form/IsActive", bState ? 1 : 0);
    }

    public onCloseAddEmployee(): void {
        (this.byId("addEmployeeOverlay") as VBox | undefined)?.setVisible(false);
    }

    public onRefreshEmployees(): void {
        void this.loadEmployees(true);
    }

    public async onCreateEmployee(): Promise<void> {
        const view = this.getView();
        if (!view) {
            return;
        }
        const model = view.getModel("emp") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;

        const firstName = String(form.FirstName || "").trim();
        const lastName = String(form.LastName || "").trim();
        const email = String(form.Email || "").trim();
        const phone = String(form.Phone || "").trim();
        const password = String(form.Password || "");
        const confirmPassword = String(form.ConfirmPassword || "");

        if (!firstName || !email || !phone || !password || !confirmPassword) {
            MessageToast.show("Please fill all required fields");
            return;
        }
        if (password !== confirmPassword) {
            MessageToast.show("Password and Confirm Password must match");
            return;
        }

        const role = String(form.Role || "employee");
        const isSuper = role === "super" ? 1 : 0;
        const isSupervisor = role === "supervisor" ? 1 : 0;

        const payload = {
            UserId: String(form.UserId || "").trim() || undefined,
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            Phone: phone,
            Password: password,
            IsSuper: isSuper,
            IsSupervisor: isSupervisor,
            IsActive: Number(form.IsActive) ? 1 : 0
        } as Record<string, any>;

        // remove undefined fields (eg. UserId)
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

        try {
            // const res = await fetch(
            //     "/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User",
            //     {
            //         method: "POST",
            //         headers: {
            //             "Accept": "application/json",
            //             "Content-Type": "application/json"
            //         },
            //         body: JSON.stringify(payload)
            //     }
            // );
            const res = await fetch(
    "/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User",
    {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.getAuthToken()}`,  // ← Yeh add karo
            "x-csrf-token": await this.getCSRFToken()  // ← Yeh bhi
        },
        body: JSON.stringify(payload)
    }
);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            MessageToast.show("Employee created successfully");

            model.setProperty("/form", {
                UserId: "",
                FirstName: "",
                LastName: "",
                Email: "",
                Phone: "",
                Password: "",
                ConfirmPassword: "",
                Role: "employee",
                IsSuper: 0,
                IsSupervisor: 0,
                IsActive: 1
            });

            this.onCloseAddEmployee();
            await this.loadEmployees();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Create employee failed:", e);
            MessageToast.show("Failed to create employee");
        }
    }

    private async loadEmployees(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;
        
        const model = view.getModel("emp") as JSONModel;
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
            let allRows = payload.value?.filter((item) => (item.IsSuper === 0 && item.IsSupervisor === 0)) || [];

            // Debug logging
            console.log("DEBUG: Raw employees from API:", payload.value);
            console.log("DEBUG: Filtered employees (only non-super, non-supervisor):", allRows);

            // Filter employees based on assigned employees for non-super users
            const userStr = window.localStorage.getItem("user");
            console.log("DEBUG: User data from localStorage:", userStr);
            
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    const isSuper = Number(user.isSuper || 0);
                    const role = (user.role || "").toLowerCase();
                    console.log("DEBUG: User isSuper:", isSuper, "User role:", role, "User:", user);
                    
                    // Check if user is admin (multiple ways: isSuper flag or role string)
                    const isAdmin = isSuper === 1 || role === 'admin' || role === 'super admin' || role === 'administrator';
                    console.log("DEBUG: Is admin user:", isAdmin);
                    
                    if (!isAdmin) {
                        const assignedEmployees = this.getAssignedEmployees();
                        console.log("DEBUG: Assigned employees from localStorage:", assignedEmployees);
                        
                        const assignedEmployeeIds = assignedEmployees.map((e: any) => e.employeeId).filter(id => id);
                        console.log("DEBUG: Assigned employee IDs:", assignedEmployeeIds);
                        
                        console.log("DEBUG: Employees before filtering:", allRows.length, allRows.map(e => ({UserId: e.UserId, FirstName: e.FirstName, LastName: e.LastName})));
                        
                        if (assignedEmployeeIds.length > 0) {
                            allRows = allRows.filter((row: any) => 
                                assignedEmployeeIds.includes(row.UserId)
                            );
                        } else {
                            console.log("DEBUG: No assigned employees found, showing empty list");
                            allRows = [];
                        }
                        
                        console.log("DEBUG: Employees after filtering:", allRows.length, allRows.map(e => ({UserId: e.UserId, FirstName: e.FirstName, LastName: e.LastName})));
                    } else {
                        console.log("DEBUG: Admin user - showing all employees");
                    }
                } catch (e) {
                    console.error("Error filtering employees:", e);
                }
            }
          
            model.setProperty("/allRows", allRows);
            this.applyFiltersAndPagination();
            
            model.setProperty("/connectionStatusText", "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());

            if (showToast) MessageToast.show(`Loaded ${allRows.length} employees`);

        } catch (e) {
            model.setProperty("/connectionStatusText", "OFFLINE");
            model.setProperty("/connectionStatusState", "Error");
            if (showToast) MessageToast.show("Failed to load employees");
            console.error("Employees API error:", e);
        }
    }
}

