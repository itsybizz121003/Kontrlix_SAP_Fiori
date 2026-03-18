import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";

/**
 * @namespace ashu.ashu.controller
 */
export default class KontrolixAI extends Controller {

    public onInit(): void {
        // later wire real Kontrolix AI backend here
    }

   

    public onLogout(): void {
        const router = (this.getOwnerComponent() as UIComponent).getRouter();
        router.navTo("login");
    }

    public onSignOut(): void {
        this.onLogout();
    }
}

