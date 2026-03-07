/**
 * Handler Types
 * Types for message, signal, and connection handlers.
 */

import type {
  IClientConnection,
  IChannel,
  DataMessage,
  SignalMessage,
} from './index'
import { ContextManager } from '../context'
import { ClientRegistry } from '../registry'

// ============================================================
// MESSAGE HANDLER
// ============================================================

/**
 * Message handler options
 *
 * @example
 * ```ts
 * const options: MessageHandlerOptions = {
 *   requireChannel: true
 * }
 * ```
 */
export interface MessageHandlerOptions {
  /**
   * Whether to require a valid channel for data messages
   * @default true
   */
  requireChannel?: boolean
}

/**
 * Message Handler
 * Processes data messages from clients.
 *
 * @remarks
 * This handler:
 * 1. Validates message format
 * 2. Retrieves the target channel
 * 3. Executes middleware pipeline
 * 4. Routes messages to channel handlers
 *
 * @example
 * ```ts
 * import { MessageHandler } from '@synnel/server/handlers'
 *
 * const messageHandler = new MessageHandler({
 *   registry: clientRegistry,
 *   middleware: middlewareManager,
 *   options: { requireChannel: true }
 * })
 *
 * // Handle incoming message
 * await messageHandler.handleMessage(client, dataMessage)
 * ```
 */
export declare class MessageHandler {
  private readonly registry
  private readonly middleware
  private readonly options

  /**
   * Create a new message handler
   *
   * @param dependencies - Handler dependencies
   * @param dependencies.registry - Client registry for channel lookups
   * @param dependencies.context - Context manager for execution
   * @param dependencies.options - Optional handler configuration
   *
   * @example
   * ```ts
   * const handler = new MessageHandler({
   *   registry: clientRegistry,
   *   context: contextManager,
   *   options: { requireChannel: true }
   * })
   * ```
   */
  constructor(dependencies: {
    registry: ClientRegistry
    context: ContextManager
    options?: MessageHandlerOptions
  })

  /**
   * Handle a message from a client
   *
   * Process flow:
   * 1. Validate message is a DataMessage
   * 2. Get channel from registry
   * 3. Build middleware pipeline (global + channel-specific)
   * 4. Execute middleware with channel handler as kernel
   *
   * @param client - The client that sent the message
   * @param message - The data message to process
   *
   * @throws {MessageError} If message format is invalid
   * @throws {ChannelError} If channel not found and requireChannel is true
   * @throws {MiddlewareRejectionError} If middleware rejects the message
   *
   * @example
   * ```ts
   * await messageHandler.handleMessage(client, {
   *   type: 'data',
   *   channel: 'chat',
   *   data: { text: 'Hello' },
   *   id: 'msg-123'
   * })
   * ```
   */
  handleMessage<T = unknown>(
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void>

  /**
   * Check if a message can be processed
   *
   * Validates message format and channel existence without processing.
   *
   * @param message - The data message to validate
   * @returns true if message can be processed
   *
   * @example
   * ```ts
   * if (messageHandler.canProcessMessage(message)) {
   *   await messageHandler.handleMessage(client, message)
   * }
   * ```
   */
  canProcessMessage<T = unknown>(message: DataMessage<T>): boolean

  /**
   * Get the channel for a message
   *
   * @param message - The data message
   * @returns Channel instance or undefined if not found
   *
   * @example
   * ```ts
   * const channel = messageHandler.getChannelForMessage(message)
   * if (channel) {
   *   console.log('Channel:', channel.name)
   * }
   * ```
   */
  getChannelForMessage<T = unknown>(
    message: DataMessage<T>,
  ): IChannel<T> | undefined

  /**
   * Get handler options
   *
   * @returns Current handler options
   *
   * @example
   * ```ts
   * const options = messageHandler.getOptions()
   * console.log('Require channel:', options.requireChannel)
   * ```
   */
  getOptions(): Readonly<Required<MessageHandlerOptions>>
}

// ============================================================
// SIGNAL HANDLER
// ============================================================

/**
 * Signal handler options
 *
 * @example
 * ```ts
 * const options: SignalHandlerOptions = {
 *   requireChannel: false,
 *   allowReservedChannels: false,
 *   sendAcknowledgments: true,
 *   autoRespondToPing: true
 * }
 * ```
 */
export interface SignalHandlerOptions {
  /**
   * Whether to require a valid channel for subscription and unsubscription
   * @default false
   */
  requireChannel?: boolean

  /**
   * Whether to allow clients to subscribe to reserved channels (starting with '__')
   * @default false
   */
  allowReservedChannels?: boolean

  /**
   * Whether to send SUBSCRIBED/UNSUBSCRIBED acknowledgment messages
   * @default true
   */
  sendAcknowledgments?: boolean

  /**
   * Whether to automatically respond to PING with PONG
   * @default true
   */
  autoRespondToPing?: boolean
}

/**
 * Signal Handler
 * Processes signal messages from clients.
 *
 * @remarks
 * This handler processes:
 * - SUBSCRIBE: Subscribe client to a channel
 * - UNSUBSCRIBE: Unsubscribe client from a channel
 * - PING: Respond with PONG (keep-alive)
 * - PONG: Update last ping time
 *
 * @example
 * ```ts
 * import { SignalHandler } from '@synnel/server/handlers'
 *
 * const signalHandler = new SignalHandler({
 *   registry: clientRegistry,
 *   middleware: middlewareManager,
 *   options: { sendAcknowledgments: true }
 * })
 *
 * // Handle subscribe signal
 * await signalHandler.handleSignal(client, {
 *   type: 'signal',
 *   signal: 'SUBSCRIBE',
 *   channel: 'chat',
 *   id: 'sig-123'
 * })
 * ```
 */
export declare class SignalHandler {
  private readonly registry
  private readonly context
  private readonly options

  /**
   * Create a new signal handler
   *
   * @param dependencies - Handler dependencies
   * @param dependencies.registry - Client registry for subscription management
   * @param dependencies.context - Context manager for execution
   * @param dependencies.options - Optional handler configuration
   *
   * @example
   * ```ts
   * const handler = new SignalHandler({
   *   registry: clientRegistry,
   *   context: contextManager,
   *   options: {
   *     requireChannel: false,
   *     sendAcknowledgments: true
   *   }
   * })
   * ```
   */
  constructor(dependencies: {
    registry: ClientRegistry
    context: ContextManager
    options?: SignalHandlerOptions
  })

  /**
   * Handle a signal message from a client
   *
   * Process flow:
   * 1. Create appropriate context for signal type
   * 2. Execute middleware pipeline
   * 3. Route to specific signal handler
   *
   * @param client - The client that sent the signal
   * @param message - The signal message to process
   *
   * @throws {MessageError} If signal type is unknown
   * @throws {ChannelError} If channel access is denied
   * @throws {MiddlewareRejectionError} If middleware rejects the signal
   *
   * @example
   * ```ts
   * await signalHandler.handleSignal(client, {
   *   type: 'signal',
   *   signal: 'SUBSCRIBE',
   *   channel: 'chat',
   *   id: 'sig-123'
   * })
   * ```
   */
  handleSignal(client: IClientConnection, message: SignalMessage): Promise<void>

  /**
   * Get handler options
   *
   * @returns Current handler options
   *
   * @example
   * ```ts
   * const options = signalHandler.getOptions()
   * console.log('Send acks:', options.sendAcknowledgments)
   * ```
   */
  getOptions(): Readonly<Required<SignalHandlerOptions>>
}

// ============================================================
// CONNECTION HANDLER
// ============================================================

/**
 * Connection handler options
 *
 * @example
 * ```ts
 * const options: ConnectionHandlerOptions = {
 *   rejectionCloseCode: 4001
 * }
 * ```
 */
export interface ConnectionHandlerOptions {
  /**
   * Close code to use when middleware rejects connection
   * @default CLOSE_CODES.REJECTED
   */
  rejectionCloseCode?: number
}

/**
 * Connection Handler
 * Processes new client connections and disconnections.
 *
 * @remarks
 * This handler:
 * 1. Executes connection middleware
 * 2. Registers client in registry
 * 3. Emits connection event
 * 4. Handles disconnections with cleanup
 *
 * @example
 * ```ts
 * import { ConnectionHandler } from '@synnel/server/handlers'
 *
 * const connectionHandler = new ConnectionHandler({
 *   registry: clientRegistry,
 *   options: { rejectionCloseCode: 4001 }
 * })
 *
 * // Handle new connection
 * await connectionHandler.handleConnection(clientConnection)
 *
 * // Handle disconnection
 * await connectionHandler.handleDisconnection(clientId)
 * ```
 */
export declare class ConnectionHandler {
  private readonly registry
  private readonly options

  /**
   * Create a new connection handler
   *
   * @param dependencies - Handler dependencies
   * @param dependencies.registry - Client registry for client management
   * @param dependencies.options - Optional handler configuration
   *
   * @example
   * ```ts
   * const handler = new ConnectionHandler({
   *   registry: clientRegistry,
   *   options: { rejectionCloseCode: 4001 }
   * })
   * ```
   */
  constructor(dependencies: {
    registry: ClientRegistry
    options?: ConnectionHandlerOptions
  })

  /**
   * Handle a new client connection
   *
   * Process flow:
   * 1. Register client in registry (creates IClientConnection)
   * 2. Execute connection middleware
   * 3. If middleware rejects, unregister and disconnect
   * 4. Emit connection event
   *
   * @param connection - The client connection
   * @returns The registered server client
   * @throws Error if middleware rejects or registration fails
   *
   * @example
   * ```ts
   * try {
   *   const client = await connectionHandler.handleConnection(clientConnection)
   *   console.log(`Client connected: ${client.id}`)
   * } catch (error) {
   *   console.log('Connection rejected:', error.message)
   * }
   * ```
   */
  handleConnection(connection: IClientConnection): Promise<IClientConnection>

  /**
   * Handle a client disconnection
   *
   * Process flow:
   * 1. Execute disconnect middleware
   * 2. Emit disconnection event (client still in registry)
   * 3. Unregister client from registry
   *
   * @param clientId - The client ID to disconnect
   * @param reason - Optional disconnection reason
   *
   * @example
   * ```ts
   * await connectionHandler.handleDisconnection('client-123', 'Client disconnected')
   * ```
   */
  handleDisconnection(clientId: string, reason?: string): Promise<void>

  /**
   * Get handler options
   *
   * @returns Current handler options
   *
   * @example
   * ```ts
   * const options = connectionHandler.getOptions()
   * console.log('Rejection close code:', options.rejectionCloseCode)
   * ```
   */
  getOptions(): Readonly<Required<ConnectionHandlerOptions>>
}
