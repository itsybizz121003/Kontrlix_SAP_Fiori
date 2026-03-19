import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";

const OAUTH_CLIENT_ID = "sb-na-171dbad3-bfd9-4183-b775-835248090a7b!a609319";
const OAUTH_CLIENT_SECRET = "741956d5-62f3-49d9-8bc6-ea0785e2f32b$l20C0hUuwllrUzcZr6M-jijw15GghBURDweaXc-_f3E=";
const OAUTH_TOKEN_PATH = "/oauth/oauth/token";

const DEFAULT_JWT_TOKEN =
    "eyJ0eXAiOiJKV1QiLCJqaWQiOiJaUkNtQ052YWF6Wjg5TUdmMG5iSHI2bGs1d0pvSDdwclJudzR5RDFuNUJVPSIsImFsZyI6IlJTMjU2Iiwiamt1IjoiaHR0cHM6Ly9jNGY3Y2MxMXRyaWFsLmF1dGhlbnRpY2F0aW9uLnVzMTAuaGFuYS5vbmRlbWFuZC5jb20vdG9rZW5fa2V5cyIsImtpZCI6ImRlZmF1bHQtand0LWtleS05ZGNkYWE4NmU1In0.eyJzdWIiOiIwNWE2YjJkNS00ZmRhLTQyYTctOTEwOC0zNWEzNjQ1NDg1MjIiLCJ4cy51c2VyLmF0dHJpYnV0ZXMiOnt9LCJ1c2VyX25hbWUiOiJjdG9AZGVlcG5hcHNvZnRlY2guY29tIiwib3JpZ2luIjoic2FwLmRlZmF1bHQiLCJpc3MiOiJodHRwczovL2M0ZjdjYzExdHJpYWwuYXV0aGVudGljYXRpb24udXMxMC5oYW5hLm9uZGVtYW5kLmNvbSIsInhzLnN5c3RlbS5hdHRyaWJ1dGVzIjp7InhzLnJvbGVjb2xsZWN0aW9ucyI6WyJTdWJhY2NvdW50IEFkbWluaXN0cmF0b3IiXX0sImdpdmVuX25hbWUiOiJEZWVwYWsiLCJjbGllbnRfaWQiOiJzYi1uYS0xNzFkYmFkMy1iZmQ5LTQxODMtYjc3NS04MzUyNDgwOTBhN2IhYTYwOTMxOSIsImF1ZCI6WyJvcGVuaWQiXSwiZXh0X2F0dHIiOnsiZW5oYW5jZXIiOiJYU1VBQSIsInN1YmFjY291bnRpZCI6IjY0ZDM1ZDkzLWE3MzMtNGI5MS1hNzIzLTQ1ZGY3N2E1OGM2NCIsInpkbiI6ImM0ZjdjYzExdHJpYWwifSwidXNlcl91dWlkIjoiMzhhZjI0MGYtMGNmMC00NTBmLWEzMjEtYzU3NjdmODNiNzFjIiwiemlkIjoiNjRkMzVkOTMtYTczMy00YjkxLWE3MjMtNDVkZjc3YTU4YzY0IiwiZ3JhbnRfdHlwZSI6InBhc3N3b3JkIiwidXNlcl9pZCI6IjA1YTZiMmQ1LTRmZGEtNDJhNy05MTA4LTM1YTM2NDU0ODUyMiIsImF6cCI6InNiLW5hLTE3MWRiYWQzLWJmZDktNDE4My1iNzc1LTgzNTI0ODA5MGE3YiFhNjA5MzE5Iiwic2NvcGUiOlsib3BlbmlkIl0sImF1dGhfdGltZSI6MTc3MzYzNzg4MiwiZXhwIjoxNzczNjgxMDgyLCJmYW1pbHlfbmFtZSI6IlNoYXJtYSIsImlhdCI6MTc3MzYzNzg4MiwianRpIjoiOGEzNDhlZjhlNmU5NGY3ZDlmOWIyNjhkMWM1NmYxYTAiLCJlbWFpbCI6ImN0b0BkZWVwbmFwc29mdGVjaC5jb20iLCJyZXZfc2lnIjoiODczM2M5NDkiLCJjaWQiOiJzYi1uYS0xNzFkYmFkMy1iZmQ5LTQxODMtYjc3NS04MzUyNDgwOTBhN2IhYTYwOTMxOSJ9.F9yfx9PB1jhMwPJFLk2nSGZZjrlYPkQXggUbz1-vep8BGZVEFdDJV8V_tmuluhMEuB2tlEnz8LuxMS5wz7XIQ6gw5EDn7t8Z-IY7YguUlNQNCv47eVugcNUeapyT9v9gjRZJxWeCcpemsEgXmBabaIuxh7QyxdP7bzRAskJqyk5SHjsov1SkvcD0dxYNiBkA8NHVzkjQpDUfbXXA_a0DUVRnBt74jtDDCGUm9gKRXRU1HmkRQ1MBJ6LcIygHkkm5W-kho7IfOj4djZ-VWjAweieVm8NACpcf4qJIDPsjAA_uqoB6gk2zkqfSMHcTRxxjX9VM71EnCIa5vK7pb0v8Xg";

/**
 * @namespace ashu.ashu.controller
 */
export default class LiveData extends Controller {

  public onInit(): void {
    const view = this.getView();
    if (!view) return;

    const liveModel = new JSONModel({
      allMachines: [], // Raw data from API
      machines: [],    // Filtered data shown in UI
      brands: [{ key: "all", text: "All Brands" }],
      filters: {
        plcBrand: "all",
        activeStatus: "all",
        machineStatus: "all",
        dateRange: "all"
      },
      connectionStatusText: "OFFLINE",
      connectionStatusState: "Error",
      lastUpdated: "-",
      tokenInput: this.getAuthToken(),
      totalMachines: 0,
      runningCount: 0,
      idleCount: 0,
      faultCount: 0,
    });
    view.setModel(liveModel, "live");
    void this.loadLiveData();
  }

  // ─────────────────────────────────────────────────────────────
  // FORMATTERS
  // ─────────────────────────────────────────────────────────────

  public formatCardClass(sStatusState: string): string {
    const base = "liveCard";
    switch (sStatusState) {
      case "Success": return `${base} runningCard`;
      case "Warning": return `${base} idleCard`;
      case "Error":   return `${base} stoppedCard`;
      default:        return base;
    }
  }

  public formatCardStyle(sStatusState: string): string {
    const base = "width:320px; border-radius:18px; padding:1rem 1.2rem; transition:all 0.3s ease;";
    switch (sStatusState) {
      case "Success": return base + "background-color:#f0fdf4; border:2.5px solid #22c55e; box-shadow:0 4px 16px rgba(34,197,94,0.25);";
      case "Warning": return base + "background-color:#fffbeb; border:2.5px solid #f59e0b; box-shadow:0 4px 16px rgba(245,158,11,0.25);";
      case "Error":   return base + "background-color:#fef2f2; border:2.5px solid #ef4444; box-shadow:0 4px 16px rgba(239,68,68,0.25);";
      default:        return base + "background-color:#ffffff; border:1px solid #e5e7eb; box-shadow:0 6px 18px rgba(15,23,42,0.08);";
    }
  }

  public formatAlarmRowClass(sAlarmState: string): string {
    return "liveCardAlarmRow " + (sAlarmState === "Error" ? "liveAlarmActive" : "liveAlarmOk");
  }

  public formatParamValClass(sStatusState: string): string {
    switch (sStatusState) {
      case "Success": return "liveCardParamVal liveCardParamValRunning";
      case "Error":   return "liveCardParamVal liveCardParamValWarn";
      default:        return "liveCardParamVal";
    }
  }

  public formatParamAlarmClass(sAlarmState: string): string {
    return sAlarmState === "Error" ? "liveCardParamVal liveCardParamValWarn" : "liveCardParamVal";
  }

  // ─────────────────────────────────────────────────────────────
  // NAVIGATION & ACTIONS
  // ─────────────────────────────────────────────────────────────

  public onLogout(): void {
    window.localStorage.clear();
    window.sessionStorage.clear();
    (this.getOwnerComponent() as UIComponent).getRouter().navTo("login");
  }

  public onSignOut(): void { this.onLogout(); }
  public onRefreshLiveData(): void { void this.loadLiveData(true); }
  public onViewMachineDetail(): void { MessageToast.show("Opening machine details..."); }

  public onSaveToken(): void {
    const view = this.getView();
    if (!view) return;
    const model = view.getModel("live") as JSONModel;
    const token = String(model.getProperty("/tokenInput") || "").trim();
    if (!token) { MessageToast.show("Please enter token first"); return; }
    window.localStorage.setItem("machineApiToken", token);
    MessageToast.show("Token saved");
    void this.loadLiveData(true);
  }

  public onClearToken(): void {
    window.localStorage.removeItem("machineApiToken");
    window.sessionStorage.removeItem("machineApiToken");
    const view = this.getView();
    if (!view) return;
    const model = view.getModel("live") as JSONModel;
    model.setProperty("/tokenInput", "");
    model.setProperty("/machines", []);
    model.setProperty("/connectionStatusText", "TOKEN MISSING");
    model.setProperty("/connectionStatusState", "Warning");
    model.setProperty("/lastUpdated", "-");
    MessageToast.show("Token cleared");
  }

  // ─────────────────────────────────────────────────────────────
  // FILTERS
  // ─────────────────────────────────────────────────────────────

  public onFilterChange(): void { this.applyFilters(); }

  public onResetFilters(): void {
    const view = this.getView();
    if (!view) return;
    const model = view.getModel("live") as JSONModel;
    model.setProperty("/filters", { plcBrand: "all", activeStatus: "all", machineStatus: "all", dateRange: "all" });
    this.applyFilters();
  }

  private applyFilters(): void {
    const view = this.getView();
    if (!view) return;
    const model   = view.getModel("live") as JSONModel;
    const allCards = model.getProperty("/allMachines") || [];
    const filters  = model.getProperty("/filters");

    const filtered = allCards.filter((card: any) => {
      if (filters.plcBrand !== "all" && card.plcBrand !== filters.plcBrand) return false;
      if (filters.activeStatus !== "all") {
        const isActive = card.status === "RUNNING" || card.status === "IDLE";
        if (filters.activeStatus === "active"   && !isActive) return false;
        if (filters.activeStatus === "inactive" &&  isActive) return false;
      }
      if (filters.machineStatus !== "all" && card.status !== filters.machineStatus) return false;
      if (filters.dateRange !== "all") {
        const cardDate = new Date(card.timestamp);
        const now = new Date();
        if (filters.dateRange === "yesterday") {
          const yStart = new Date(now); yStart.setDate(now.getDate() - 1); yStart.setHours(0,0,0,0);
          const yEnd   = new Date(yStart); yEnd.setHours(23,59,59,999);
          if (cardDate < yStart || cardDate > yEnd) return false;
          return true;
        }
        let minDate = new Date();
        switch (filters.dateRange) {
          case "today":       minDate.setHours(0,0,0,0); break;
          case "thisWeek":    minDate.setDate(now.getDate() - now.getDay()); minDate.setHours(0,0,0,0); break;
          case "thisMonth":   minDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case "last3Months": minDate.setMonth(now.getMonth() - 3); break;
        }
        if (cardDate < minDate) return false;
      }
      return true;
    });

    model.setProperty("/machines",     filtered);
    model.setProperty("/totalMachines", filtered.length);
    model.setProperty("/runningCount",  filtered.filter((c: any) => c.statusState === "Success").length);
    model.setProperty("/idleCount",     filtered.filter((c: any) => c.statusState === "Warning").length);
    model.setProperty("/faultCount",    filtered.filter((c: any) => c.statusState === "Error").length);
  }

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING  ← MAIN FIX IS HERE
  // ─────────────────────────────────────────────────────────────

  public onFilterChange(): void {
    this.applyFilters();
  }

  public onResetFilters(): void {
    const view = this.getView();
    if (!view) return;
    const model = view.getModel("live") as JSONModel;
    model.setProperty("/filters", {
      plcBrand: "all",
      activeStatus: "all",
      machineStatus: "all",
      dateRange: "all"
    });
    this.applyFilters();
  }

  private applyFilters(): void {
    const view = this.getView();
    if (!view) return;
    const model = view.getModel("live") as JSONModel;
    const allCards = model.getProperty("/allMachines") || [];
    const filters = model.getProperty("/filters");

    let filtered = allCards.filter((card: any) => {
      // 1. PlcBrand Filter
      if (filters.plcBrand !== "all" && card.plcBrand !== filters.plcBrand) {
        return false;
      }

      // 2. Active/Inactive Filter
      // (Assuming 'Active' means status is RUNNING or IDLE, 'Inactive' means STOPPED or UNKNOWN)
      if (filters.activeStatus !== "all") {
        const isActive = (card.status === "RUNNING" || card.status === "IDLE");
        if (filters.activeStatus === "active" && !isActive) return false;
        if (filters.activeStatus === "inactive" && isActive) return false;
      }

      // 3. Machine Status Filter
      if (filters.machineStatus !== "all" && card.status !== filters.machineStatus) {
        return false;
      }

      // 4. Date Range Filter
      if (filters.dateRange !== "all") {
        const cardDate = new Date(card.timestamp);
        const now = new Date();
        let minDate = new Date();

        switch (filters.dateRange) {
          case "today":
            minDate.setHours(0, 0, 0, 0);
            break;
          case "yesterday":
            minDate.setDate(now.getDate() - 1);
            minDate.setHours(0, 0, 0, 0);
            const maxDate = new Date(minDate);
            maxDate.setHours(23, 59, 59, 999);
            if (cardDate < minDate || cardDate > maxDate) return false;
            return true; // Special case for yesterday range
          case "thisWeek":
            const day = now.getDay(); // 0 is Sunday
            minDate.setDate(now.getDate() - day);
            minDate.setHours(0, 0, 0, 0);
            break;
          case "thisMonth":
            minDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "last3Months":
            minDate.setMonth(now.getMonth() - 3);
            break;
        }
        if (cardDate < minDate) return false;
      }

      return true;
    });

    // Update the UI model
    model.setProperty("/machines", filtered);
    model.setProperty("/totalMachines", String(filtered.length));
    
    // Update summary counts based on filtered data
    const running = filtered.filter((c: any) => c.statusState === "Success").length;
    const idle    = filtered.filter((c: any) => c.statusState === "Warning").length;
    const faulted = filtered.filter((c: any) => c.statusState === "Error").length;
    
    model.setProperty("/runningCount", String(running));
    model.setProperty("/idleCount", String(idle));
    model.setProperty("/faultCount", String(faulted));
  }

  private async loadLiveData(showToast = false): Promise<void> {
    const view = this.getView();
    if (!view) return;
    const model     = view.getModel("live") as JSONModel;
    const authToken = await this.resolveAuthToken();

    if (!authToken) {
      model.setProperty("/connectionStatusText",  "TOKEN MISSING");
      model.setProperty("/connectionStatusState", "Warning");
      if (showToast) MessageToast.show("machineApiToken not found in browser storage");
      return;
    }

    try {
      const response = await fetch(
        "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/Machine",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = (await response.json()) as { value?: Array<Record<string, any>> };
      const rows = payload.value || [];
      const latestRows = this.getLatestRowsByDevice(rows);
      const allCards = latestRows.map((row) => {
        const card = this.toCardData(row);
        // Ensure we store the raw brand for filtering
        card.plcBrand = String(row.PlcBrand || "Unknown");
        return card;
      });

      // Update brand list dynamically
      const brandsSet = new Set<string>();
      allCards.forEach(c => brandsSet.add(c.plcBrand));
      const brandItems = [{ key: "all", text: "All Brands" }];
      Array.from(brandsSet).sort().forEach(b => brandItems.push({ key: b, text: b }));
      model.setProperty("/brands", brandItems);

      model.setProperty("/allMachines", allCards);
      this.applyFilters();

      model.setProperty("/connectionStatusText", "ONLINE");
      model.setProperty("/connectionStatusState", "Success");
      model.setProperty("/lastUpdated", new Date().toLocaleString());

      if (showToast) MessageToast.show(`Loaded ${allCards.length} machines`);

    } catch (error) {
      model.setProperty("/connectionStatusText",  "OFFLINE");
      model.setProperty("/connectionStatusState", "Error");
      if (showToast) MessageToast.show("Failed to load live data");
      console.error("Live data API error:", error);
    }
  }

  // ── Pagination support — saare pages fetch karo ───────────────────────────
  // OData v4 default page size chota hota hai (20), isliye @odata.nextLink follow karo
  private async fetchAllPages(authToken: string): Promise<Array<Record<string, any>>> {
    const allRows: Array<Record<string, any>> = [];

    // Pehla request — $top=1000 taaki zyada se zyada ek baar mein aaye
    let url: string | null =
      "/sap/opu/odata4/sap/zmachine_sb/srvd_a2x/sap/zmachine_sd/0001/Machine?$top=1000&$orderby=Timestamp desc";

    while (url) {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json() as {
        value?: Array<Record<string, any>>;
        "@odata.nextLink"?: string;
      };

      const rows = payload.value || [];
      allRows.push(...rows);

      // Agar nextLink hai toh agle page pe jao, warna ruk jao
      url = payload["@odata.nextLink"] ?? null;

      // Safety: agar 5000 se zyada rows aa gayi toh rok lo
      if (allRows.length >= 5000) break;
    }

    return allRows;
  }

  // ─────────────────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────────────────

  private getAuthToken(): string {
    return (
      window.localStorage.getItem("machineApiToken") ||
      window.sessionStorage.getItem("machineApiToken") ||
      DEFAULT_JWT_TOKEN ||
      ""
    );
  }

  private async resolveAuthToken(): Promise<string> {
    const manualToken = this.getAuthToken();
    if (manualToken) return manualToken;

    try {
      const body = new URLSearchParams();
      body.set("grant_type",    "password");
      body.set("username",      "cto@deepnapsoftech.com");
      body.set("password",      "Kiara@7065003066");
      body.set("client_id",     OAUTH_CLIENT_ID);
      body.set("client_secret", OAUTH_CLIENT_SECRET);

      const tokenResponse = await fetch(OAUTH_TOKEN_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: body.toString(),
      });

      if (!tokenResponse.ok) throw new Error(`Token API failed: ${tokenResponse.status}`);

      const tokenPayload = await tokenResponse.json() as { access_token?: string };
      const accessToken  = String(tokenPayload.access_token || "").trim();
      if (!accessToken) return "";

      window.localStorage.setItem("machineApiToken", accessToken);
      const m = this.getView()?.getModel("live") as JSONModel | undefined;
      m?.setProperty("/tokenInput", accessToken);
      return accessToken;

    } catch (error) {
      console.error("Token generation failed:", error);
      return "";
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  // Har DeviceId ka sirf ek (latest Timestamp wala) record rakho
  private getLatestRowsByDevice(rows: Array<Record<string, any>>): Array<Record<string, any>> {
    const latestMap: Record<string, Record<string, any>> = {};

    rows.forEach((row) => {
      const deviceId  = String(row.DeviceId || "UNKNOWN");
      const currentTs = this.toTimestampMs(row.Timestamp);
      const existing  = latestMap[deviceId];

      if (!existing || currentTs > this.toTimestampMs(existing.Timestamp)) {
        latestMap[deviceId] = row;
      }
    });

    // Latest timestamp wale device pehle
    return Object.values(latestMap).sort(
      (a, b) => this.toTimestampMs(b.Timestamp) - this.toTimestampMs(a.Timestamp),
    );
  }

  private toTimestampMs(timestampValue: unknown): number {
    if (!timestampValue) return 0;
    let ts = String(timestampValue).trim();
    ts = ts.replace(" UTC", "Z").replace(" UT", "Z");
    if (ts.includes(" ") && !ts.includes("T")) ts = ts.replace(" ", "T");
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private toCardData(row: Record<string, any>): Record<string, string> {
    let alarm = "NONE", temperature = "-", pressure = "-", rpm = "-", productionCount = "-";

    try {
      const parameters = row.Parameters ? JSON.parse(String(row.Parameters)) : {};
      alarm           = String(parameters.ALARM        || "NONE");
      temperature     = String(parameters.TEMPERATURE  || parameters.TEMP || "-");
      pressure        = String(parameters.PRESSURE     || "-");
      rpm             = String(parameters.RPM          || "-");
      productionCount = String(row.ProductionCount     || parameters.PRODUCTION || "-");
    } catch { alarm = "NONE"; }

    const status      = String(row.Status || "UNKNOWN");
    const statusUpper = status.toUpperCase();

    const statusState =
      statusUpper === "RUNNING" ? "Success" :
      statusUpper === "IDLE"    ? "Warning" :
      statusUpper === "WARNING" ? "Warning" : "Error";

    const alarmState =
      alarm === "NONE"        ? "Success" :
      alarm.includes("WARN")  ? "Warning" : "Error";

    return {
      deviceId:        String(row.DeviceId     || "-"),
      subLine:         String(row.Companyname  || "-"),
      status,
      statusState,
      model:           String(row.PlcModel     || "-"),
      partNo:          String(row.PartNo       || "-"),
      material:        String(row.MaterialCode || "-"),
      alarm,
      alarmState,
      startTime:       String(row.StartTime    || row.Timestamp || "-"),
      timestamp:       String(row.Timestamp    || "-"),
      productionCount,
      rpm,
      temperature,
      pressure,
      MachineBrand:    String(row.MachineBrand || "-"),
    };
  }

  public onSideItemPress(oEvent: any): void {
    const item   = oEvent.getParameter("listItem") as any;
    const title  = item.getTitle && item.getTitle();
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
      "My Profile":           "myProfile",
    };
    const route = map[title];
    if (route) router.navTo(route);
  }
}