/**
 * Type Utilities
 * Reusable type manipulation utilities for the @synnel/server package.
 */

// ============================================================
// MERGE TYPES
// ============================================================

/**
 * Merge two types, with U taking precedence for conflicting properties.
 * Useful for extending base types with additional properties.
 *
 * @example
 * ```ts
 * type Base = { a: string; b: number }
 * type Extended = MergeTypes<Base, { b: string; c: boolean }>
 * // Result: { a: string; b: string; c: boolean }
 * ```
 */
export type MergeTypes<T, U> = Omit<T, keyof U> & U

// ============================================================
// DEEP PARTIAL
// ============================================================

/**
 * Make all properties in T optional recursively.
 * Useful for partial updates of nested objects.
 *
 * @example
 * ```ts
 * type Config = { server: { host: string; port: number } }
 * type PartialConfig = DeepPartial<Config>
 * // Result: { server?: { host?: string; port?: number } }
 * ```
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P]
}

// ============================================================
// DEEP READONLY
// ============================================================

/**
 * Make all properties in T readonly recursively.
 * Useful for immutable state.
 *
 * @example
 * ```ts
 * type Config = { server: { host: string; port: number } }
 * type ReadonlyConfig = DeepReadonly<Config>
 * // Result: { readonly server: { readonly host: string; readonly port: number } }
 * ```
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Array<infer U>
      ? ReadonlyArray<DeepReadonly<U>>
      : DeepReadonly<T[P]>
    : T[P]
}

// ============================================================
// PRETTIFY
// ============================================================

/**
 * Prettify types - removes unions with empty object type.
 * Useful for cleaning up conditional type results for better IDE display.
 *
 * @example
 * ```ts
 * type Ugly = { a: string } & { b: number } & {}
 * type Pretty = Prettify<Ugly>
 * // Result: { a: string; b: number }
 * ```
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

// ============================================================
// KEYS OF TYPE
// ============================================================

/**
 * Extract keys of T whose values extend type U.
 *
 * @example
 * ```ts
 * interface User {
 *   id: number
 *   name: string
 *   age: number
 *   active: boolean
 * }
 * type NumberKeys = KeysOfType<User, number>
 * // Result: "id" | "age"
 * ```
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never
}[keyof T]

// ============================================================
// PICK BY TYPE
// ============================================================

/**
 * Pick properties from T whose values extend type U.
 *
 * @example
 * ```ts
 * interface User {
 *   id: number
 *   name: string
 *   age: number
 *   active: boolean
 * }
 * type NumberProps = PickByType<User, number>
 * // Result: { id: number; age: number }
 * ```
 */
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>

// ============================================================
// OMIT BY TYPE
// ============================================================

/**
 * Omit properties from T whose values extend type U.
 *
 * @example
 * ```ts
 * interface User {
 *   id: number
 *   name: string
 *   age: number
 *   active: boolean
 * }
 * type NonBooleanProps = OmitByType<User, boolean>
 * // Result: { id: number; name: string; age: number }
 * ```
 */
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>

// ============================================================
// REQUIRED KEYS
// ============================================================

/**
 * Make specific properties K required (others remain as-is).
 *
 * @example
 * ```ts
 * interface User {
 *   id?: number
 *   name?: string
 *   age?: number
 * }
 * type WithRequiredId = RequiredKeys<User, 'id'>
 * // Result: { id: number; name?: string; age?: number }
 * ```
 */
export type RequiredKeys<T, K extends keyof T> = keyof T> = T & Required<Pick<T, K>>

// ============================================================
// OPTIONAL KEYS
// ============================================================

/**
 * Make specific properties K optional (others remain as-is).
 *
 * @example
 * ```ts
 * interface User {
 *   id: number
 *   name: string
 *   age: number
 * }
 * type WithOptionalAge = OptionalKeys<User, 'age'>
 * // Result: { id: number; name: string; age?: number }
 * ```
 */
export type OptionalKeys<T, K extends keyof T> = keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// ============================================================
// BRANDED TYPE
// ============================================================

/**
 * Branded type for nominal typing - adds type safety at compile time.
 * Prevents accidental mixing of types that share the same underlying type.
 *
 * @example
 * ```ts
 * type UserId = Branded<string, 'UserId'>
 * type ClientId = Branded<string, 'ClientId'>
 *
 * function getUser(id: UserId) { ... }
 * function getClient(id: ClientId) { ... }
 *
 * const userId = '123' as UserId
 * const clientId = '123' as ClientId
 *
 * getUser(userId)    // OK
 * getClient(userId)  // Type error!
 * ```
 */
export type Branded<T, B extends string> = T & { readonly __brand: B }

// ============================================================
// AWAITED
// ============================================================

/**
 * Extract the resolved type of a Promise.
 *
 * @example
 * ```ts
 * type AsyncUser = Promise<{ id: number; name: string }>
 * type User = Awaited<AsyncUser>
 * // Result: { id: number; name: string }
 * ```
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T

// ============================================================
// FUNCTION PARAMETERS
// ============================================================

/**
 * Extract function parameters.
 *
 * @example
 * ```ts
 * function foo(a: string, b: number) {}
 * type FooParams = FnParameters<typeof foo>
 * // Result: [string, number]
 * ```
 */
export type FnParameters<T extends (...args: any[]) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never

// ============================================================
// FUNCTION RETURN TYPE
// ============================================================

/**
 * Extract function return type.
 *
 * @example
 * ```ts
 * function foo() { return { id: 1 } }
 * type FooReturn = FnReturnType<typeof foo>
 * // Result: { id: number }
 * ```
 */
export type FnReturnType<T extends (...args: any[]) => any> = T extends (
  ...args: any[]
) => infer R
  ? R
  : any

// ============================================================
// FUNCTION PROPERTY NAMES
// ============================================================

/**
 * Extract function property names from T.
 *
 * @example
 * ```ts
 * class MyClass {
 *   prop: string
 *   method1(): void
 *   method2(): number
 * }
 * type Methods = FunctionPropertyNames<MyClass>
 * // Result: "method1" | "method2"
 * ```
 */
export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

// ============================================================
// ONLY METHODS
// ============================================================

/**
 * Pick only function properties from T.
 *
 * @example
 * ```ts
 * class MyClass {
 *   prop: string
 *   method1(): void
 *   method2(): number
 * }
 * type OnlyMethods = OnlyMethods<MyClass>
 * // Result: { method1: () => void; method2: () => number }
 * ```
 */
export type OnlyMethods<T> = Pick<T, FunctionPropertyNames<T>>

// ============================================================
// OPTIONAL KEYS OF
// ============================================================

/**
 * Extract keys of T that are optional.
 *
 * @example
 * ```ts
 * interface User {
 *   id: number
 *   name: string
 *   age?: number
 *   email?: string
 * }
 * type OptionalKeys = OptionalKeysOf<User>
 * // Result: "age" | "email"
 * ```
 */
export type OptionalKeysOf<T extends object> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

// ============================================================
// REQUIRED KEYS OF
// ============================================================

/**
 * Extract keys of T that are required.
 *
 * @example
 * ```ts
 * interface User {
 *   id: number
 *   name: string
 *   age?: number
 *   email?: string
 * }
 * type RequiredKeys = RequiredKeysOf<User>
 * // Result: "id" | "name"
 * ```
 */
export type RequiredKeysOf<T extends object> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

// ============================================================
// ARRAY ELEMENT
// ============================================================

/**
 * Extract the element type of an array or tuple.
 *
 * @example
 * ```ts
 * type Numbers = number[]
 * type Num = ArrayElement<Numbers>
 * // Result: number
 *
 * type Tuple = [string, number, boolean]
 * type First = ArrayElement<Tuple>
 * // Result: string
 * ```
 */
export type ArrayElement<T> = T extends (infer U)[]
  ? U
  : T extends readonly (infer U)[]
    ? U
    : T extends { 0: infer U }
      ? U
      : never

// ============================================================
// VALUE OF TYPE
// ============================================================

/**
 * Extract the value type from a type.
 * Useful for getting union of all property values.
 *
 * @example
 * ```ts
 * type Events = {
 *   CLICK: 'click'
 *   HOVER: 'hover'
 *   FOCUS: 'focus'
 * }
 * type EventValues = ValueOf<Events>
 * // Result: 'click' | 'hover' | 'focus'
 * ```
 */
export type ValueOf<T> = T[keyof T]

// ============================================================
// UNION TO INTERSECTION
// ============================================================

/**
 * Convert a union type to an intersection type.
 *
 * @example
 * ```ts
 * type Union = { a: string } | { b: number }
 * type Intersection = UnionToIntersection<Union>
 * // Result: { a: string } & { b: number }
 * ```
 */
export type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends (k: infer I) => void
  ? I
  : never

// ============================================================
// LAST OF TUPLE
// ============================================================

/**
 * Get the last element of a tuple type.
 *
 * @example
 * ```ts
 * type Tuple = [string, number, boolean]
 * type Last = LastOfTuple<Tuple>
 * // Result: boolean
 * ```
 */
export type LastOfTuple<T extends readonly unknown[]> = T extends readonly [...any[], infer L]
  ? L
  : never

// ============================================================
// TUPLE TO UNION
// ============================================================

/**
 * Convert a tuple type to a union type.
 *
 * @example
 * ```ts
 * type Tuple = [string, number, boolean]
 * type Union = TupleToUnion<Tuple>
 * // Result: string | number | boolean
 * ```
 */
export type TupleToUnion<T extends readonly unknown[]> = T[number]
