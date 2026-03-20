import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import UIComponent from "sap/ui/core/UIComponent";
import Input from "sap/m/Input";

const OAUTH_CLIENT_ID = "sb-na-171dbad3-bfd9-4183-b775-835248090a7b!a609319";
const OAUTH_CLIENT_SECRET = "741956d5-62f3-49d9-8bc6-ea0785e2f32b$l20C0hUuwllrUzcZr6M-jijw15GghBURDweaXc-_f3E=";
const OAUTH_TOKEN_PATH = "https://c4f7cc11trial.authentication.us10.hana.ondemand.com/oauth/token";
const LOGIN_URL = "/sap/bc/http/sap/ZLOGIN_HTTP?sap-client=100";

/**
 * @namespace ashu.ashu.controller
 */
export default class ashui extends Controller {

    public onInit(): void { }

    public async onSignIn(): Promise<void> {
        const view = this.getView();
        if (!view) return;

        const emailInput = view.byId("emailInput") as Input;
        const passwordInput = view.byId("passwordInput") as Input;


        const email = emailInput?.getValue()?.trim() || "";
        const password = passwordInput?.getValue()?.trim() || "";
        if (!email || !password) {
            MessageToast.show("Email aur Password daalo!");
            return;
        }

        MessageToast.show("Logging in...");

        try {
            // Step 1 - SAP OAuth Token lo (Fixed technical credentials used here)
            const sapToken = await this.getSAPToken();

            if (!sapToken) {
                MessageToast.show("Token generation failed!");
                return;
            }

            // Step 2 - Login API call karo
            const loginResponse = await fetch(LOGIN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${sapToken}`,
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: JSON.stringify({ email, password })
            });

            const loginData = await loginResponse.json() as {
                success?: boolean;
                token?: string;
                message?: string;
                user?: {
                    userId?: string;
                    email?: string;
                    firstName?: string;
                    lastName?: string;
                    isSuper?: number;
                    isSupervisor?: number;

                };
                assignedResources?: Array<{
                    resourceId?: string;
                    name?: string;
                }>;
                assignedEmployees?: Array<{
                    employeeId?: string;
                    firstName?: string;
                }>;
                supervisor
                ?: Array<{
                    supervisorId?: string;
                    
                }>;

            };

            if (loginData.success && loginData.token) {
                // Tokens save karo
                window.localStorage.setItem("machineApiToken", sapToken);
                window.localStorage.setItem("appToken", String(loginData.token));
                window.localStorage.setItem("user", JSON.stringify(loginData.user));
                window.localStorage.setItem("supervisors", JSON.stringify(loginData.supervisor));

                // Store assigned resources and employees
                if (loginData.assignedResources) {
                    window.localStorage.setItem("assignedResources", JSON.stringify(loginData.assignedResources));
                }
                if (loginData.assignedEmployees) {
                    window.localStorage.setItem("assignedEmployees", JSON.stringify(loginData.assignedEmployees));
                }

                MessageToast.show(`Welcome ${String(loginData.user?.firstName || "")}!`);

                // Role ke hisaab se redirect karo
                const router = (this.getOwnerComponent() as UIComponent).getRouter();
                const isSuper = Number(loginData.user?.isSuper || 0);
                const isSupervisor = Number(loginData.user?.isSupervisor || 0);

                if (isSuper === 1) {
                    router.navTo("dashboard");
                } else if (isSupervisor === 1) {
                    router.navTo("supervisor");
                } else {
                    router.navTo("employees");
                }

            } else {
                MessageToast.show(String(loginData.message || "Invalid credentials!"));
            }

        } catch (error) {
            console.error("Login error:", error);
            MessageToast.show("Login failed! Try again.");
        }
    }

    private async getSAPToken(): Promise<string> {
        try {
            const body = new URLSearchParams();
            body.set("grant_type", "password");
            body.set("username", "cto@deepnapsoftech.com");
            body.set("password", "Kiara@7065003066");
            body.set("client_id", OAUTH_CLIENT_ID);
            body.set("client_secret", OAUTH_CLIENT_SECRET);

            const tokenResponse = await fetch(OAUTH_TOKEN_PATH, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                body: body.toString()
            });

            if (!tokenResponse.ok) {
                throw new Error(`Token failed: ${tokenResponse.status}`);
            }

            const tokenData = await tokenResponse.json() as {
                access_token?: string;
            };

            return String(tokenData.access_token || "").trim();

        } catch (error) {
            console.error("SAP Token error:", error);
            return "";
        }
    }

    public onForgotPassword(): void {
        MessageToast.show("Contact admin for password reset!");
    }
}