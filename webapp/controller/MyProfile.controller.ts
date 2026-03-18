import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import VBox from "sap/m/VBox";

/**
 * @namespace ashu.ashu.controller
 */
export default class MyProfile extends Controller {

    public onInit(): void {
        const view = this.getView();
        if (!view) return;

        const userStr = window.localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) as Record<string, any> : {};

        const isSuper = Number(user.isSuper || 0);
        const isSupervisor = Number(user.isSupervisor || 0);
        const role = isSuper === 1 ? "Admin" :
                     isSupervisor === 1 ? "Supervisor" : "Employee";

        const profileModel = new JSONModel({
            userId: String(user.userId || "-"),
            firstName: String(user.firstName || "-"),
            lastName: String(user.lastName || "-"),
            email: String(user.email || "-"),
            role: role,
            isSuper: isSuper,
            isSupervisor: isSupervisor,
            fullName: `${String(user.firstName || "")} ${String(user.lastName || "")}`.trim(),
            initials: this.getInitials(
                String(user.firstName || ""),
                String(user.lastName || "")
            ),
            phone: "-",
            companyName: "-",
            address: "-",
            gstin: "-",
            bankName: "-",
            accountNo: "-",
            ifscCode: "-",
            isLoading: true,
            // Edit form
            editForm: {
                FirstName: String(user.firstName || ""),
                LastName: String(user.lastName || ""),
                Phone: "",
                CpnyName: "",
                Address: "",
                Gstin: "",
                BankName: "",
                AccountNo: "",
                IfscCode: ""
            }
        });

        view.setModel(profileModel, "profile");
        void this.loadUserDetails(
            String(user.userId || ""),
            isSupervisor === 1
        );
    }

    private getInitials(firstName: string, lastName: string): string {
        return `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}` || "??";
    }

    private async loadUserDetails(userId: string, isSupervisor: boolean): Promise<void> {
        const view = this.getView();
        if (!view || !userId) return;

        const model = view.getModel("profile") as JSONModel;
        const token = window.localStorage.getItem("machineApiToken") || "";

        try {
            const url = isSupervisor
                ? `/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Supervisor('${userId}')`
                : `/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User('${userId}')`;

            const res = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json() as Record<string, any>;

            console.log("this is my data",data)

            // Profile data update karo
            model.setProperty("/phone", String(data.Phone || "-"));
            model.setProperty("/CpnyName", String(data.CpnyName || "-"));
            
            model.setProperty("/address", String(data.Address || "-"));
            model.setProperty("/gstin", String(data.Gstin || "-"));
            model.setProperty("/bankName", String(data.BankName || "-"));
            model.setProperty("/accountNo", String(data.AccountNo || "-"));
            model.setProperty("/ifscCode", String(data.IfscCode || "-"));
            model.setProperty("/isLoading", false);

            // Edit form prefill karo
            model.setProperty("/editForm/FirstName", String(data.FirstName || ""));
            model.setProperty("/editForm/LastName", String(data.LastName || ""));
            model.setProperty("/editForm/Phone", String(data.Phone || ""));
            model.setProperty("/editForm/CpnyName", String(data.CpnyName || ""));
            model.setProperty("/editForm/Address", String(data.Address || ""));
            model.setProperty("/editForm/Gstin", String(data.Gstin || ""));
            model.setProperty("/editForm/BankName", String(data.BankName || ""));
            model.setProperty("/editForm/AccountNo", String(data.AccountNo || ""));
            model.setProperty("/editForm/IfscCode", String(data.IfscCode || ""));

        } catch (e) {
            console.error("Profile load error:", e);
            model.setProperty("/isLoading", false);
        }
    }

    // Edit drawer open/close
    public onOpenEditProfile(): void {
        (this.byId("editProfileOverlay") as VBox | undefined)?.setVisible(true);
    }

    public onCloseEditProfile(): void {
        (this.byId("editProfileOverlay") as VBox | undefined)?.setVisible(false);
    }

    // Profile Update karo
    public async onUpdateProfile(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const model = view.getModel("profile") as JSONModel;
        const form = model.getProperty("/editForm") as Record<string, any>;
        const userId = String(model.getProperty("/userId"));
        const isSupervisor = Number(model.getProperty("/isSupervisor")) === 1;
        const token = window.localStorage.getItem("machineApiToken") || "";

        const payload: Record<string, any> = {
            FirstName: String(form.FirstName || "").trim(),
            LastName: String(form.LastName || "").trim(),
            Phone: String(form.Phone || "").trim(),
            CpnyName: String(form.CpnyName || "").trim(),
            Address: String(form.Address || "").trim(),
            Gstin: String(form.Gstin || "").trim(),
            BankName: String(form.BankName || "").trim(),
            AccountNo: String(form.AccountNo || "").trim(),
            IfscCode: String(form.IfscCode || "").trim()
        };

        try {
            const csrfToken = await this.getCSRFToken(isSupervisor);

            const url = isSupervisor
                ? `/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Supervisor('${userId}')`
                : `/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User('${userId}')`;

            const res = await fetch(url, {
                method: "PATCH",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-csrf-token": csrfToken
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            MessageToast.show("Profile updated successfully!");

            // localStorage update karo
            const userStr = window.localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr) as Record<string, any>;
                user.firstName = payload.FirstName;
                user.lastName = payload.LastName;
                window.localStorage.setItem("user", JSON.stringify(user));
            }

            // Model update karo
            model.setProperty("/firstName", payload.FirstName as string);
            model.setProperty("/lastName", payload.LastName as string);
            model.setProperty("/fullName", `${payload.FirstName as string} ${payload.LastName as string}`.trim());
            model.setProperty("/phone", payload.Phone as string);
            model.setProperty("/companyName", payload.CpnyName as string);
            model.setProperty("/address", payload.Address as string);
            model.setProperty("/gstin", payload.Gstin as string);
            model.setProperty("/bankName", payload.BankName as string);
            model.setProperty("/accountNo", payload.AccountNo as string);
            model.setProperty("/ifscCode", payload.IfscCode as string);
            model.setProperty("/initials", this.getInitials(
                payload.FirstName as string,
                payload.LastName as string
            ));

            this.onCloseEditProfile();

        } catch (e) {
            console.error("Profile update error:", e);
            MessageToast.show("Failed to update profile!");
        }
    }

    private async getCSRFToken(isSupervisor: boolean): Promise<string> {
        const token = window.localStorage.getItem("machineApiToken") || "";
        try {
            const url = isSupervisor
                ? "/sap/opu/odata4/sap/zkontrolix_sb/srvd_a2x/sap/zkontrolix_sd/0001/Supervisor"
                : "/sap/opu/odata4/sap/zkontrolix_user_sb/srvd_a2x/sap/zkontrolix_user_sd/0001/User";

            const res = await fetch(url, {
                method: "GET",
                headers: {
                    "x-csrf-token": "fetch",
                    "Authorization": `Bearer ${token}`
                }
            });
            return res.headers.get("x-csrf-token") || "";
        } catch {
            return "";
        }
    }

    public onSideItemPress(oEvent: any): void {
        const item = oEvent.getParameter("listItem") as any;
        const title = item.getTitle && item.getTitle();
        const router = (this.getOwnerComponent() as UIComponent).getRouter();

        if (title === "Monitoring-Dashboard") router.navTo("dashboard");
        else if (title === "Live Data") router.navTo("liveData");
        else if (title === "Supervisor") router.navTo("supervisor");
        else if (title === "Employees") router.navTo("employees");
        else if (title === "Machine History") router.navTo("machineHistory");
        else if (title === "Resources") router.navTo("resources");
        else if (title === "Machine Info") router.navTo("machineInfo");
        else if (title === "Stoppage Info") router.navTo("stoppageInfo");
        else if (title === "Requests") router.navTo("requests");
        else if (title === "Kontrolix-AI") router.navTo("kontrolixAI");
        else if (title === "My Profile") router.navTo("myProfile");
    }

    public onLogout(): void {
        window.localStorage.removeItem("machineApiToken");
        window.localStorage.removeItem("appToken");
        window.localStorage.removeItem("user");
        MessageToast.show("Logged out successfully!");
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        router.navTo("login");
    }

    public onSignOut(): void {
        this.onLogout();
    }
}