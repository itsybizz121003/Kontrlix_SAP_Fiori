import BaseController from "./BaseController";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import VBox from "sap/m/VBox";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace ashu.ashu.controller
 */
export default class Resources extends BaseController {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const resourcesModel = new JSONModel({
            allRows: [],
            rows: [],
            rowCount: 0,
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            searchQuery: "",
            isAdmin: false, // New property for UI visibility
            connectionStatusText: "OFFLINE",
            connectionStatusState: "Error",
            lastUpdated: "-",
            brandList: [{ key: "", text: "Select PLC Brand" }],
            ui: {
                mode: "ADD",
                modalTitle: "Add New Resource",
                confirmButtonText: "Submit"
            },
            form: {
                ResourceId: "",
                ResName: "",
                ResType: "",
                Specification: "",
                CustomId: ""
            }
        });

        view.setModel(resourcesModel, "res");

        // Role check for UI visibility
        const userStr = window.localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : {};
        const role = String(user.Role || user.role || "").toUpperCase();
        resourcesModel.setProperty("/isAdmin", role === "ADMIN" || role === "SUPER ADMIN");

        void this.loadResources();
        void this.loadPlcBrands();
    }

    private async loadPlcBrands(): Promise<void> {
        const model = this.getView()?.getModel("res") as JSONModel;
        const token = this.getAuthToken();

        try {
            const res = await fetch(
                "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/Machine?$select=PlcBrand",
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
            const machines = payload.value || [];

            // Unique brands nikaalo
            const brandsSet = new Set<string>();
            machines.forEach((m: any) => {
                if (m.PlcBrand) brandsSet.add(String(m.PlcBrand));
            });

            const brandList = [{ key: "", text: "Select PLC Brand" }];
            Array.from(brandsSet).sort().forEach(brand => {
                brandList.push({ key: brand, text: brand });
            });

            model.setProperty("/brandList", brandList);

        } catch (e) {
            console.error("Failed to load PLC brands:", e);
        }
    }

    public onOpenAddResource(): void {
        const model = this.getView()?.getModel("res") as JSONModel;
        model.setProperty("/ui/mode", "ADD");
        model.setProperty("/ui/modalTitle", "Add New Resource");
        model.setProperty("/ui/confirmButtonText", "Submit");
        model.setProperty("/form", {
            ResourceId: "",
            ResName: "",
            ResType: "",
            Specification: "",
            CustomId: ""
        });
        (this.byId("addResourceOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onViewResource(oEvent: any): void {
        const context = oEvent.getSource().getBindingContext("res");
        const data = context.getObject();
        const model = this.getView()?.getModel("res") as JSONModel;

        model.setProperty("/ui/mode", "VIEW");
        model.setProperty("/ui/modalTitle", "Resource Details");
        model.setProperty("/ui/confirmButtonText", "");
        model.setProperty("/form", Object.assign({}, data));

        (this.byId("addResourceOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onEditResource(oEvent: any): void {
        const context = oEvent.getSource().getBindingContext("res");
        const data = context.getObject();
        const model = this.getView()?.getModel("res") as JSONModel;

        model.setProperty("/ui/mode", "EDIT");
        model.setProperty("/ui/modalTitle", "Edit Resource");
        model.setProperty("/ui/confirmButtonText", "Update");
        model.setProperty("/form", Object.assign({}, data));

        (this.byId("addResourceOverlay") as VBox | undefined)?.setVisible(true);
    }

    public async onDeleteResource(oEvent: any): Promise<void> {
        const context = oEvent.getSource().getBindingContext("res");
        const data = context.getObject();
        const resourceId = data.ResourceId;

        if (!resourceId) return;

        MessageBox.confirm(`Are you sure you want to delete this Resource (${resourceId})?`, {
            title: "Confirm Deletion",
            onClose: async (sAction: string | null) => {
                if (sAction === MessageBox.Action.OK) {
                    try {
                        const token = this.getAuthToken();
                        const csrfToken = await this.getCSRFToken();

                        const res = await fetch(
                            `/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Resource(ResourceId='${resourceId}')`,
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

                        MessageToast.show("Resource deleted successfully!");
                        await this.loadResources();

                    } catch (e) {
                        console.error("Delete resource failed:", e);
                        MessageToast.show("Failed to delete resource");
                    }
                }
            }
        });
    }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter("query") || "";
        const model = this.getView()?.getModel("res") as JSONModel;
        model.setProperty("/searchQuery", sQuery);
        model.setProperty("/currentPage", 1);
        this.applyFiltersAndPagination();
    }

    public onPrevPage(): void {
        const model = this.getView()?.getModel("res") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        if (currentPage > 1) {
            model.setProperty("/currentPage", currentPage - 1);
            this.applyFiltersAndPagination();
        }
    }

    public onNextPage(): void {
        const model = this.getView()?.getModel("res") as JSONModel;
        const currentPage = model.getProperty("/currentPage");
        const totalPages = model.getProperty("/totalPages");
        if (currentPage < totalPages) {
            model.setProperty("/currentPage", currentPage + 1);
            this.applyFiltersAndPagination();
        }
    }

    private applyFiltersAndPagination(): void {
        const model = this.getView()?.getModel("res") as JSONModel;
        const allRows = model.getProperty("/allRows") || [];
        const searchQuery = (model.getProperty("/searchQuery") || "").toLowerCase();
        const currentPage = model.getProperty("/currentPage") || 1;
        const pageSize = model.getProperty("/pageSize") || 10;

        let filteredRows = allRows;
        if (searchQuery) {
            filteredRows = allRows.filter((row: any) => {
                return (row.ResName || "").toLowerCase().includes(searchQuery) ||
                       (row.ResType || "").toLowerCase().includes(searchQuery) ||
                       (row.CustomId || "").toLowerCase().includes(searchQuery);
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
        const model = this.getView()?.getModel("res") as JSONModel;
        const mode = model.getProperty("/ui/mode");
        if (mode === "ADD") void this.onSubmitResource();
        else if (mode === "EDIT") void this.onUpdateResource();
    }

    public async onUpdateResource(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("res") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;
        const resourceId = form.ResourceId;

        if (!resourceId) {
            MessageToast.show("Resource ID is missing");
            return;
        }

        const payload = {
            ResName: String(form.ResName || "").trim(),
            ResType: String(form.ResType || "").trim(),
            Specification: String(form.Specification || "").trim()
        };

        try {
            const token = this.getAuthToken();
            const csrfToken = await this.getCSRFToken();

            const res = await fetch(
                `/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Resource(ResourceId='${resourceId}')`,
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

            MessageToast.show("Resource updated successfully");
            this.onCloseAddResource();
            await this.loadResources();
        } catch (e) {
            console.error("Update resource failed:", e);
            MessageToast.show("Failed to update resource");
        }
    }

    public onCloseAddResource(): void {
        (this.byId("addResourceOverlay") as VBox | undefined)?.setVisible(false);
    }

    public onRefreshResources(): void {
        void this.loadResources(true);
    }

    public async onSubmitResource(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("res") as JSONModel;
        const form = model.getProperty("/form") as Record<string, any>;

        const resName = String(form.ResName || "").trim();
        const resType = String(form.ResType || "").trim();
        const customId = String(form.CustomId || "").trim();

        if (!resName || !resType || !customId) {
            MessageToast.show("Please fill all required fields");
            return;
        }

        const payload: Record<string, any> = {
            ResName: resName,
            ResType: resType,
            Specification: String(form.Specification || "").trim(),
            CustomId: customId
        };

        if (String(form.ResourceId || "").trim()) {
            payload["ResourceId"] = String(form.ResourceId).trim();
        }

        try {
            const token = this.getAuthToken();
            const csrfToken = await this.getCSRFToken();

            const res = await fetch(
                "/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Resource",
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

            MessageToast.show("Resource created successfully!");

            model.setProperty("/form", {
                ResourceId: "",
                ResName: "",
                ResType: "",
                Specification: "",
                CustomId: ""
            });

            this.onCloseAddResource();
            await this.loadResources();

        } catch (e) {
            console.error("Create resource failed:", e);
            MessageToast.show("Failed to create resource");
        }
    }

    private async loadResources(showToast = false): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("res") as JSONModel;
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
        let allRows = payload.value || [];

        // Debug logging
        console.log("DEBUG: Raw resources from API:", allRows);

        // Filter resources based on role
        const userStr = window.localStorage.getItem("user");
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                const role = String(user.Role || user.role || "").toUpperCase();
                const isAdmin = role === "ADMIN" || role === "SUPER ADMIN";

                if (!isAdmin) {
                    const assignedResources = this.getAssignedResources();
                    const assignedResourceIds = assignedResources.map((r: any) => r.resourceId);
                    
                    if (assignedResourceIds.length > 0) {
                        allRows = allRows.filter((row: any) => 
                            assignedResourceIds.includes(row.ResourceId)
                        );
                    } else {
                        allRows = [];
                    }
                }
            } catch (e) {
                console.error("Error filtering resources:", e);
            }
        }

        model.setProperty("/allRows", allRows);
        this.applyFiltersAndPagination();

        this.updateConnectionStatus(model, showToast, allRows.length);
    } catch (e) {
        this.updateConnectionStatus(model, showToast, 0, true);
        console.error("Resources API error:", e);
    }
}

    private updateConnectionStatus(model: JSONModel, showToast: boolean, resourcesLength: number, isError: boolean = false): void {
        if (isError) {
            model.setProperty("/connectionStatusText", "OFFLINE");
            model.setProperty("/connectionStatusState", "Error");
            if (showToast) MessageToast.show("Failed to load resources");
        } else {
            model.setProperty("/connectionStatusText", "ONLINE");
            model.setProperty("/connectionStatusState", "Success");
            model.setProperty("/lastUpdated", new Date().toLocaleString());
            if (showToast) MessageToast.show(`Loaded ${resourcesLength} resources`);
        }
    }
}