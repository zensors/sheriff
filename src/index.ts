/**
 * A utility function for asserting that a check is exhaustive.
 *
 * @param _arg - the value whose checks we would like to assert were exhaustive
 * @param message - a message to display if we somehow reach this position (generally due to unsafe runtime usage)
 */
function unreachable(_arg: never, message: string) {
	throw new Error(message);
}

/**
 * The type of a descriptor object that can be used to marshal values of type `T`.
 */
export type Marshaller<T> =
	| { kind: "literal", value: T }
	| (boolean extends T ? { kind: "boolean" } : never)
	| (number extends T ? { kind: "number" } : never)
	| (string extends T ? { kind: "string" } : never)
	| (undefined extends T ? { kind: "optional", type: Marshaller<Exclude<T, undefined>> } : never)
	| { kind: "object", fields: ObjectMarshaller<T> }
	| (T extends (infer S)[] ? S[] extends T ? { kind: "array", type: Marshaller<S> } : never : never)
	| (T extends any[] ? { kind: "tuple", fields: TupleMarshaller<T> } : never)
	| { kind: "union", types: Marshaller<T>[] }
	| { kind: "recursive", self: Marshaller<T> }
	| { kind: "any" }
	| (unknown extends T ? { kind: "unknown" } : never)
	| { kind: "custom", type: Marshaller<T>, fn: (data: T) => void }
	| (T extends Record<string, infer U> ? Record<string, U> extends T ? { kind: "record", type: Marshaller<U> } : never : never)
	| (T extends (infer T1 & { __typeWitness: infer T2 }) ? (T1 & { __typeWitness: T2 }) extends T ?
		{ kind: "witness", type: Marshaller<T1> } : never : never)
	;

/**
 * The type of an object whose fields describe the fields of an object to be marshalled.
 *
 * @see {M.obj}
 */
export type ObjectMarshaller<T> = { [K in keyof T]-?: Marshaller<T[K]> };

/**
 * The type of a tuple whose fields describe the fields of a tuple to be marshalled.
 *
 * @see {M.tup}
 */
export type TupleMarshaller<T extends any[]> = number extends T["length"] ? never : { [K in keyof T]: Marshaller<T[K]> };

/**
 * Converts a path within an object to a human-readable string.
 *
 * @param name - the name of the root object
 * @param path - the list of keys within that object
 */
let pathStringify = (name: string, path: (string | number)[]): string =>
	path.reduce<string>((agg, next) => typeof next === "string" ? `${agg}.${next}` : `${agg}[${next}]`, name);

/**
 * An error encountered while marshalling.  If you encounter one of these, the request that led to it should be
 * rejected.
 *
 * A `MarshalError`'s message is intended to be human-readable and should not be considered safe for any particular
 * purpose (e.g., don't serve it in an HTTP server without either encoding it first or setting an appropriate content
 * type).
 */
export class MarshalError extends Error {
	/**
	 * The name of the root object whose marshalling resulted in this error.
	 */
	public name: string;

	/**
	 * The path within the object whose marshalling failed.
	 */
	public path: (string | number)[];

	/**
	 * A message describing why marshalling failed.
	 */
	public info: string;

	/**
	 * The type of rule that resulted in the marshalling failure.
	 */
	public rule: string;

	constructor(name: string, path: (string | number)[], info: string, rule: string) {
		let message = `[At ${pathStringify(name, path)}]: ${info}`;
		super(message);

		this.name = name;
		this.path = path;
		this.info = info;
		this.rule = rule;
	}
}

/**
 * Ensures that `obj` ascribes to the type described by `description`, throwing an error if it deviates from that
 * description.
 *
 * @param obj - the object to be marshalled
 * @param description - the type description to check against
 * @param name - the name used in errors to describe the root object
 * @param path - the path from the root object to the current position
 * @throws MarshalError - thrown when the object does not match the description
 */
export function marshal<T extends X, X = unknown>(
	obj: X,
	description: Marshaller<T>,
	name: string = "INPUT",
	path: (string | number)[] = []
): asserts obj is T {
	function fail(message: string): never {
		throw new MarshalError(name, path, message, description.kind);
	}

	function assertHere(test: boolean, message: string): asserts test is true {
		if (!test) {
			fail(message);
		}
	}

	switch (description.kind) {
		case "literal": {
			assertHere(obj === description.value, `Expected constant value ${description.value}, got ${obj}`);
			break;
		}

		case "boolean": {
			assertHere(typeof obj === "boolean", `Expected boolean, got ${typeof obj}`);
			break;
		}

		case "number": {
			assertHere(typeof obj === "number", `Expected number, got ${typeof obj}`);
			break;
		}

		case "string": {
			assertHere(typeof obj === "string", `Expected string, got ${typeof obj}`);
			break;
		}

		case "optional": {
			if (obj !== undefined) {
				marshal(obj, description.type, name, path);
			}
			break;
		}

		case "object": {
			if (typeof obj !== "object") {
				fail(`Expected object, got ${typeof obj}`);
			}

			if (obj === null) {
				fail("Expected object, got null");
			}

			if ("__proto__" in obj && (obj as any).__proto__ !== Object.prototype) {
				if (Array.isArray(obj)) {
					fail("Expected object, got array");
				}

				fail("Encountered prototype pollution");
			}

			const getUnionOrder = (m: Marshaller<unknown>) => (
				m.kind !== "literal" ? 1 :
				m.value === "kind" ? -1 :
				0
			);

			let keys = Object.keys(description.fields)
				.sort((k1, k2) => {
					let m1: Marshaller<unknown> = (description.fields as any)[k1];
					let m2: Marshaller<unknown> = (description.fields as any)[k2];
					return getUnionOrder(m1) - getUnionOrder(m2);
				}) as (string & keyof typeof obj)[];

			for (let key of keys) {
				marshal(obj[key], (description.fields as any)[key], name, path.concat([key]));
			}

			for (let key in obj) {
				if (!(key in description.fields)) {
					return assertHere(false, `Found unexpected key: ${key}`);
				}
			}

			break;
		}

		case "array": {
			if (Array.isArray(obj)) {
				obj.forEach((element, idx) => marshal(element, description.type, name, path.concat([idx])));
			} else {
				assertHere(false, `Expected array, got ${typeof obj}`);
			}

			break;
		}

		case "tuple": {
			if (Array.isArray(obj)) {
				assertHere(
					obj.length === (description.fields as any).length,
					`Invalid tuple size: Expected ${description.fields.length}, got ${obj.length}`
				);
				obj.forEach((element, idx) => marshal(element, description.fields[idx], name, path.concat([idx])));
			} else {
				assertHere(false, `Expected tuple, got ${typeof obj}`);
			}

			break;
		}

		case "union": {
			let errors: MarshalError[] = [];

			let success = description.types.some((desc) => {
				try {
					marshal(obj, desc, name, path);
					return true;
				} catch (e) {
					if (e instanceof MarshalError) {
						errors.push(e);
						return false;
					} else {
						throw e;
					}
				}
			});

			if (success) {
				break;
			}

			// Because we have a general idea of how unions are used we can give better feedback based on certain
			// heuristics. Our methodology is the following.
			//
			// 1. If we have non-zero children whose type is object with a literal kind field, we assume that we are
			//    dealing with a discriminated union. Then
			//    a. If we failed at a non-constant match or at a depth greater than the discriminator's depth, we show
			//       the first such error
			//    b. If [obj] had a [kind] discriminator, but still weren't able to match, assume that the [obj.kind]
			//       discriminator was wrong, and show it with possible values
			//    c. Otherwise, we did not have a discriminator, so show the discriminator's possible values.
			// 2. If we did not have a discriminator in our child list, we assume the structure is probably a primitive
			//    and so we show both what we have, and what we expect.

			let discriminatorValues: string[] = [];

			for (let type of description.types) {
				if (type.kind === "object"
					&& "kind" in type.fields
					&& (type.fields as any).kind.kind === "literal"
				) {
					discriminatorValues.push((type.fields as any).kind.value);
				}
			}

			if (discriminatorValues.length !== 0) {
				for (let err of errors) {
					if (err.rule !== "literal" || err.path.length !== path.length + 1) {
						throw err;
					}
				}

				if (typeof obj === "object" && obj !== null && "kind" in obj) {
					assertHere(
						false,
						`Unable to match against union.`
							+ ` Found "kind" discriminator: [${(obj as any).kind}], but needed one of [${discriminatorValues.join(" | ")}]`
					);
				} else {
					assertHere(
						false,
						`Unable to find "kind" discriminator. Expecting one of [${discriminatorValues.join(" | ")}]`
					);
				}
			} else {
				assertHere(
					false,
					`Unable to match against union. Expected one of [${description.types.map(({ kind }) => kind).join(" | ")}]`
				);
			}

			break;
		}

		case "recursive": {
			marshal(obj, description.self, name, path);
			break;
		}

		case "any":
		case "unknown": {
			break;
		}

		case "custom": {
			marshal(obj, description.type, name, path);

			try {
				let result = description.fn(obj);

				if (result !== undefined) {
					fail("Custom validation function unexpectedly returned a value");
				}
			} catch (error) {
				assertHere(false, error.message);
			}

			break;
		}

		case "record": {
			if (typeof obj !== "object") {
				fail(`Expected object, got ${typeof obj}`);
			}

			if (obj === null) {
				fail("Expected object, got null");
			}

			if ("__proto__" in obj && (obj as any).__proto__ !== Object.prototype) {
				if (Array.isArray(obj)) {
					fail("Expected object, got array");
				}

				fail("Encountered prototype pollution");
			}

			(Object.keys(obj) as (string & keyof typeof obj)[])
				.forEach((key) => marshal(obj[key] as unknown, description.type, name, path.concat([key])));
			break;
		}

		case "witness": {
			marshal(obj, description.type, name, path);
			break;
		}

		default:
			unreachable(
				description,
				`Reached unexpected type description "${(description as any).kind}" at ${pathStringify(name, path)}`
			);
	}
}

export namespace M {
	/**
	 * Returns a marshaller for a literal value.  Note that validation is done with a triple-equals check, so this
	 * should only be used for primitive values, and will result in validation errors if the two objects are not
	 * identical.
	 *
	 * @param value - the value to match against
	 */
	export const lit = <T extends string | number | boolean | undefined | null>(value: T): Marshaller<T> => ({ kind: "literal" as const, value });

	/**
	 * A marshaller accepting all booleans.
	 */
	export const bool: Marshaller<boolean> = { kind: "boolean" as const };

	/**
	 * A marshaller accepting all numbers.
	 */
	export const num: Marshaller<number> = { kind: "number" as const };

	/**
	 * A marshaller accepting all strings.
	 */
	export const str: Marshaller<string> = { kind: "string" as const };

	/**
	 * Returns a marshaller for an optional value of the given marshaller type.
	 *
	 * @param type - the base marshaller
	 */
	export const opt = <T>(type: Marshaller<T>) => ({ kind: "optional" as const, type }) as Marshaller<T | undefined>;

	/**
	 * The keys that are required and do not accept `undefined` as a possible value in the given object type `T`.
	 */
	type RequiredKeys<T> = {
		[K in keyof T]-?: unknown extends T[K] ? K : undefined extends T[K] ? never : K;
	}[keyof T];

	/**
	 * The keys that either are not required or which accept `undefined` as a possible value in the given object type `T`.
	 */
	type NonRequiredKeys<T> = {
		[K in keyof T]-?: unknown extends T[K] ? never : undefined extends T[K] ? K : never;
	}[keyof T];

	/**
	 * The object type `T` with all possibly-`undefined` fields marked as optional.
	 */
	type Optionalize<T> = { [K in RequiredKeys<T>]: T[K] } & { [K in NonRequiredKeys<T>]?: T[K] };

	/**
	 * Returns a marshaller for an object with the specified field types.  Excess fields will be considered marshal
	 * errors.  Missing fields will be considered marshal errors unless their marshaller accepts `undefined`.  (It is
	 * not possible to specify a field that must exist but which may take `undefined` as a value.)
	 *
	 * @param fields - a mapping from fields names to marshallers that will be used to check those fields
	 */
	export const obj = <T>(fields: ObjectMarshaller<T>) => ({
		kind: "object",
		fields
	}) as Marshaller<Optionalize<T>>;

	/**
	 * Returns a marshaller for an array of values of the specified type.
	 *
	 * @param type - a marshaller for the types of the elements in the array
	 */
	export const arr = <T>(type: Marshaller<T>): Marshaller<T[]> => ({ kind: "array" as const, type });

	/**
	 * Returns a marshaller for a tuple with the specified field types.
	 *
	 * @param types - marshallers for the individual fields of the tuple
	 */
	export const tup = <T extends any[]>(...types: TupleMarshaller<T>): Marshaller<T> => ({
		kind: "tuple" as const,
		fields: types
	}) as Marshaller<T>;

	/**
	 * Returns a marshaller for a union of the given input types.
	 *
	 * @param types - marshallers for the constituent types of the tuple
	 */
	export function union<T1, T2>(t1: Marshaller<T1>, t2: Marshaller<T2>): Marshaller<T1 | T2>;
	export function union<T1, T2, T3>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>): Marshaller<T1 | T2 | T3>;
	export function union<T1, T2, T3, T4>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>, t4: Marshaller<T4>): Marshaller<T1 | T2 | T3 | T4>;
	export function union<T1, T2, T3, T4, T5>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>, t4: Marshaller<T4>, t5: Marshaller<T5>): Marshaller<T1 | T2 | T3 | T4 | T5>;
	export function union<T1, T2, T3, T4, T5, T6>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>, t4: Marshaller<T4>, t5: Marshaller<T5>, t6: Marshaller<T6>): Marshaller<T1 | T2 | T3 | T4 | T5 | T6>;
	export function union<T1, T2, T3, T4, T5, T6, T7>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>, t4: Marshaller<T4>, t5: Marshaller<T5>, t6: Marshaller<T6>, t7: Marshaller<T7>): Marshaller<T1 | T2 | T3 | T4 | T5 | T6 | T7>;
	export function union<T1, T2, T3, T4, T5, T6, T7, T8>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>, t4: Marshaller<T4>, t5: Marshaller<T5>, t6: Marshaller<T6>, t7: Marshaller<T7>, t8: Marshaller<T8>): Marshaller<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8>;
	export function union<T1, T2, T3, T4, T5, T6, T7, T8, T9>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>, t4: Marshaller<T4>, t5: Marshaller<T5>, t6: Marshaller<T6>, t7: Marshaller<T7>, t8: Marshaller<T8>, t9: Marshaller<T9>): Marshaller<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9>;
	export function union<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(t1: Marshaller<T1>, t2: Marshaller<T2>, t3: Marshaller<T3>, t4: Marshaller<T4>, t5: Marshaller<T5>, t6: Marshaller<T6>, t7: Marshaller<T7>, t8: Marshaller<T8>, t9: Marshaller<T9>, t10: Marshaller<T10>): Marshaller<T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10>;
	export function union<T>(...types: Marshaller<T>[]): Marshaller<T> {
		return { kind: "union" as const, types };
	}

	/**
	 * Returns a marshaller for a recursive type.
	 *
	 * @param f - a function that, given a `Marshaller<T>`, produces a `Marshaller<T>` one level shallower
	 *
	 * @description
	 * To define a marshaller for a binary tree of numbers, you might use something like the following:
	 *
	 * ```ts
	 * interface Tree {
	 *     value: number;
	 *     left?: Tree;
	 *     right?: Tree;
	 * }
	 *
	 * const TreeMarshaller: Marshaller<Tree> =
	 *     M.rec((self) => M.obj({ value: M.num, left: M.opt(self), right: M.opt(self) }))
	 * ```
	 */
	export const rec = <T>(f: (self: Marshaller<T>) => Marshaller<T>) => {
		let parent = { kind: "recursive", self: undefined } as any;
		parent.self = f(parent);
		return parent as Marshaller<T>;
	};

	/**
	 * A marshaller that maches any value, resulting in a value with type `any`.  Consider using `M.unk` instead.
	 *
	 * @see {M.unk}
	 */
	export const any: Marshaller<any> = { kind: "any" as const };

	/**
	 * A marshaller that matches any value, resulting in a value with type `unknown`.
	 */
	export const unk: Marshaller<unknown> = { kind: "unknown" as const };

	/**
	 * Returns a marshaller that marshals using the provided marshaller, and then does additional checks using the
	 * provided function.  Note that the provided function should throw an error with an appropriate message if
	 * validation fails.  Returning any value other than `undefined` from the validation error will result in a
	 * marshalling error at usage time.
	 *
	 * @param type - the marshaller to use to marshal the value before passing it to the validation function
	 * @param fn - the validation function; must throw an error if validation fails, and return `undefined` otherwise
	 */
	export const custom = <T>(type: Marshaller<T>, fn: (arg: T) => void): Marshaller<T> => ({
		kind: "custom" as const,
		type,
		fn
	});

	/**
	 * Returns a marshaller for an object with any keys whose values are all of the given marshaller type.
	 *
	 * @param type - a marshaller for the types of the values in the object
	 */
	export const record = <T>(type: Marshaller<T>): Marshaller<Record<string, T>> => ({ kind: "record", type });

	/**
	 * Returns a marshaller for an object and attaches a type witness to its type.  (In TypeScript, this is often
	 * referred to as _branding_.)
	 *
	 * @param type - a marshaller for the type of the object, without the type witness
	 */
	export const witness = <T, U>(type: Marshaller<T>): Marshaller<T & {__typeWitness: U}> =>
		({ kind: "witness", type }) as Marshaller<T & { __typeWitness: U }>;

	/**
	 * A marshaller accepting only `null`.
	 */
	export const nul = lit(null);

	/**
	 * A marshaller accepting only `undefined`.
	 */
	export const undef = lit(undefined);

	/**
	 * A marshaller accepting only integers.
	 */
	export const int = custom(M.num, (x) => {
		if (!Number.isInteger(x)) {
			throw new Error("Expected integer, got non-integer");
		}
	});
}
