import WebSocket from "sap/ui/core/ws/WebSocket";
import ReadyState from "sap/ui/core/ws/ReadyState";

/**
 * SocketService handles real-time communication using WebSockets.
 * If no WebSocket URL is available, it can be extended to use polling as fallback.
 */
export default class SocketService {
    private _socket: WebSocket | null = null;
    private _onMessageCallback: (data: any) => void;

    constructor(onMessage: (data: any) => void) {
        this._onMessageCallback = onMessage;
    }

    /**
     * Connect to the WebSocket server
     * @param sUrl The WebSocket URL (e.g., wss://your-backend-socket.com)
     */
    public connect(sUrl: string): void {
        if (this._socket) {
            this._socket.close();
        }

        try {
            this._socket = new WebSocket(sUrl);

            this._socket.attachOpen(() => {
                console.log("Socket connection opened");
            });

            this._socket.attachClose(() => {
                console.log("Socket connection closed");
            });

            this._socket.attachError((oEvent: any) => {
                console.error("Socket error:", oEvent);
            });

            this._socket.attachMessage((oEvent: any) => {
                const sData = oEvent.getParameter("data");
                try {
                    const oData = JSON.parse(sData);
                    this._onMessageCallback(oData);
                } catch (e) {
                    this._onMessageCallback(sData);
                }
            });

        } catch (e) {
            console.error("Failed to initialize WebSocket:", e);
        }
    }

    /**
     * Close the WebSocket connection
     */
    public disconnect(): void {
        if (this._socket) {
            this._socket.close();
            this._socket = null;
        }
    }

    /**
     * Send data via the WebSocket
     * @param oData Data to send
     */
    public send(oData: any): void {
        if (this._socket && this._socket.getReadyState() === ReadyState.OPEN) {
            const sData = typeof oData === "string" ? oData : JSON.stringify(oData);
            this._socket.send(sData);
        } else {
            console.error("Socket is not open. Cannot send data.");
        }
    }
}
