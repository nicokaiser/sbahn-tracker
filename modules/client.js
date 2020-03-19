const WebSocket = window && window.WebSocket || require('websocket').w3cwebsocket;

export default class SBahnClient {
    constructor(apiKey) {
        this._apiKey = apiKey;
        this._callbacks = {};

        this._isActive = false;
        this._socket = null;
        this._reconnectDelay = null;

        this.clientTimeDiff = 0;
    }

    on(source, callback) {
        if (this._socket && this._socket.readyState === 1) {
            this._socket.send('GET ' + source);
            this._socket.send('SUB ' + source);
        }

        this._callbacks[source] = callback;
    }

    remove(source) {
        if (this._socket && this._socket.readyState === 1) {
            this._socket.send('DEL ' + source);
        }

        delete this._callbacks[source];
    }

    connect() {
        if (this._isActive) return;

        this._isActive = true;
        this._connect();
    }

    close() {
        if (!this._isActive) return;

        this._isActive = false;
        if (this._socket) this._socket.close();
        if (this._reconnectDelay) clearTimeout(this._reconnectDelay);
    }

    _connect() {
        this._socket = new WebSocket('wss://api.geops.io/realtime-ws/v1/?key=' + this._apiKey);

        this._socket.onopen = () => {
            Object.keys(this._callbacks).forEach(source => {
                this._socket.send('GET ' + source);
                this._socket.send('SUB ' + source);
            });
        };

        this._socket.onclose = () => {
            this._socket = null;

            if (this._isActive) {
                this._reconnectDelay = setTimeout(() => this._connect(), 100);
            }
        };

        this._socket.onmessage = (event) => {
            let message = null;
            try {
                message = JSON.parse(event.data);
            } catch (err) {
                console.warn('Ignored invalid JSON in WebSocket message: ' + err.message, event.data);
                return;
            }

            this.clientTimeDiff = Date.now() - message.timestamp;

            if (message.source === 'websocket') {
                // ignoring message: content: {status: "open"}
                // TODO: implement ping/pong
            } else if (this._callbacks.hasOwnProperty(message.source)) {
                this._callbacks[message.source](message.content);
            } else {
                console.warn(`Unknown source "${message.source}" in WebSocket message`, event.data);
            }
        };
    }
}
