/**
 * Handles message routing and callback management for both client and server.
 */
export class Dispatcher {
    protected callbacks: Set<(message: any, sender?: any) => void> = new Set();

    /**
     * Register a message listener.
     */
    onMessage(callback: (message: any, sender?: any) => void) {
        this.callbacks.add(callback);
        return () => {
            this.callbacks.delete(callback);
        };
    }

    /**
     * Route a message to all registered listeners.
     */
    emit(message: any, sender?: any) {
        this.callbacks.forEach((cb) => cb(message, sender));
    }

    /**
     * Process a raw string/buffer from transport and emit to listeners.
     */
    processRaw(data: string | Buffer, sender?: any) {
        try {
            const message = JSON.parse(data.toString());
            this.emit(message, sender);
            return message;
        } catch (e) {
            console.error('Dispatcher: Failed to parse message', e);
            return null;
        }
    }

    /**
     * Clear all listeners.
     */
    clear() {
        this.callbacks.clear();
    }
}
