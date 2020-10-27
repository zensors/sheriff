import type { Request, Response } from "express";
import * as util from "util";

function unreachable(arg: never) {
	throw new Error(`Got to unreachable location with value: ${arg}`);
}

const PRIMITIVE_SYMBOL = Symbol("Dummy type");

type RequiredKeys<T> = {
	[K in keyof T]-?: unknown extends T[K] ? K : undefined extends T[K] ? never : K;
}[keyof T];

type NonRequiredKeys<T> = {
	[K in keyof T]-?: unknown extends T[K] ? never : undefined extends T[K] ? K : never;
}[keyof T];

type KeyFix<T> = { [K in RequiredKeys<T>]: T[K] } & { [K in NonRequiredKeys<T>]?: T[K] };

export type MarshalObject<T> = {
	[K in keyof T]-?: MarshalUnion<T[K]>;
};

export type MarshalUnion<T> =
	| {
		kind: "string",
		[PRIMITIVE_SYMBOL]: (T extends string ? T : never)
	}
	| {
		kind: "constant", value: T,
		[PRIMITIVE_SYMBOL]: T
	}
	| {
		kind: "boolean",
		[PRIMITIVE_SYMBOL]: (T extends boolean ? T : never)
	}
	| {
		kind: "number",
		[PRIMITIVE_SYMBOL]: (T extends number ? T : never)
	}
	| (T extends (infer S)[]
		? { kind: "array", type: MarshalUnion<S> }
		: never)
	| (T extends any[]
		? { kind: "tuple", type: { [K in keyof T]: MarshalUnion<T[K]> } }
		: never)
	| (T extends (infer S) | undefined
		? { kind: "optional", type: MarshalUnion<S> }
		: never)
	// The typescript special
	// tslint:disable:max-line-length
	| (T extends (infer T1) | (infer T2)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3) | (infer T4)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>, MarshalUnion<T4>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3) | (infer T4) | (infer T5)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>, MarshalUnion<T4>, MarshalUnion<T5>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3) | (infer T4) | (infer T5) | (infer T6)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>, MarshalUnion<T4>, MarshalUnion<T5>, MarshalUnion<T6>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3) | (infer T4) | (infer T5) | (infer T6) | (infer T7)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>, MarshalUnion<T4>, MarshalUnion<T5>, MarshalUnion<T6>, MarshalUnion<T7>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3) | (infer T4) | (infer T5) | (infer T6) | (infer T7) | (infer T8)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>, MarshalUnion<T4>, MarshalUnion<T5>, MarshalUnion<T6>, MarshalUnion<T7>, MarshalUnion<T8>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3) | (infer T4) | (infer T5) | (infer T6) | (infer T7) | (infer T8) | (infer T9)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>, MarshalUnion<T4>, MarshalUnion<T5>, MarshalUnion<T6>, MarshalUnion<T7>, MarshalUnion<T8>, MarshalUnion<T9>] }
		: never)
	| (T extends (infer T1) | (infer T2) | (infer T3) | (infer T4) | (infer T5) | (infer T6) | (infer T7) | (infer T8) | (infer T9) | (infer T10)
		? { kind: "union", types: [MarshalUnion<T1>, MarshalUnion<T2>, MarshalUnion<T3>, MarshalUnion<T4>, MarshalUnion<T5>, MarshalUnion<T6>, MarshalUnion<T7>, MarshalUnion<T8>, MarshalUnion<T9>, MarshalUnion<T10>] }
		: never)
	// tslint:enable:max-line-length
	| (T extends (infer T1 & { __typeWitness: infer T2 }) ? { kind: "witness", type: MarshalUnion<T1> } : never)
	| { kind: "recursive", self: MarshalUnion<T> }
	| { kind: "any" }
	| { kind: "unknown" }
	| { kind: "logically-verified", spec: MarshalUnion<T>, fn: (data: T) => boolean }
	| { kind: "object", marshal: MarshalObject<T> }
	| ({ [K in keyof T]: T[K] } extends ({ [key: string]: infer S })
		? { kind: "dictionary", type: MarshalUnion<S> }
		: never)
	;

export type Unmarshal<T> = T extends MarshalUnion<infer S> ? S : never;

let pathStringify = (path: (string | number)[]): string =>
	path.reduce<string>((agg, next) => typeof next === "string" ? `${agg}.${next}` : `${agg}[${next}]`, "INPUT");

export class MarshalError extends Error {
	public path: (string | number)[];
	public info: string;
	public rule: string;

	constructor(path: (string | number)[], info: string, rule: string) {
		let message = `[At ${pathStringify(path)}]: ${info}`;
		super(message);

		this.path = path;
		this.info = info;
		this.rule = rule;
	}
}

function assert(test: boolean, path: (string | number)[], message: string, rule: string): asserts test is true {
	if (!test) {
		throw new MarshalError(path, message, rule);
	}
}

export function marshal<T>(
	obj: any,
	description: MarshalUnion<T>,
	path: (string | number)[] = []
): asserts obj is T {
	function assertHere(test: boolean, message: string): asserts test is true {
		assert(test, path, message, description.kind);
	}

	switch (description.kind) {
		case "constant": {
			assertHere(obj === description.value, `Expected constant value ${description.value}, got ${obj}`);
			break;
		}

		case "string": {
			assertHere(typeof obj === "string", `Expected string, got ${typeof obj}`);
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

		case "object": {
			assertHere(typeof obj === "object", `Expected object, got ${typeof obj}`);
			assertHere(!("__proto__" in obj) || obj.__proto__ === Object.prototype, `Found prototype pollution`);

			const getUnionOrder = (m: MarshalUnion<unknown>) => (
				m.kind !== "constant" ? 1 :
				m.value === "kind" ? -1 :
				0
			);

			let keys = Object.keys(description.marshal)
				.sort((k1, k2) => {
					let m1: MarshalUnion<unknown> = (description.marshal as any)[k1];
					let m2: MarshalUnion<unknown> = (description.marshal as any)[k2];
					return getUnionOrder(m1) - getUnionOrder(m2);
				});

			for (let key of keys) {
				marshal(obj[key], (description.marshal as any)[key], path.concat([key]));
			}

			for (let key in obj) {
				if (!(key in description.marshal)) {
					return assertHere(false, `Found unexpected key: ${key}`);
				}
			}

			break;
		}

		case "array": {
			if (Array.isArray(obj)) {
				obj.every((element, idx) => marshal(element, description.type, path.concat([idx])));
			} else {
				assertHere(false, `Expected array, got ${typeof obj}`);
			}

			break;
		}

		case "tuple": {
			if (Array.isArray(obj)) {
				assertHere(
					obj.length === (description.type as unknown as unknown[]).length,
					`Invalid tuple size, got ${obj.length}, expected ${description.type.length}`
				);
				obj.every((element, idx) => marshal(element, description.type[idx], path.concat([idx])));
			} else {
				assertHere(false, `Expected tuple, got ${typeof obj}`);
			}

			break;
		}

		case "optional": {
			if (obj !== undefined) {
				marshal(obj, description.type, path);
			}

			break;
		}

		case "union": {
			let errors: MarshalError[] = [];

			let success = description.types.some((desc) => {
				try {
					marshal(obj, desc, path);
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
			// 1. If we have non-zero children whose type is object with a constant kind field, we assume that we are
			//    dealing with a discriminated union. Then
			//    a. If we failed at a non-constant match or at a depth greater than the next immediate, we show
			//       the first such error
			//    b. If we had a [kind] discriminator ourselves, but still weren't able to match, assume that our [kind]
			//       discriminator was wrong, and show it with possible values
			//    c. Otherwise, we did not have a discriminator, so show the possible values of one.
			// 2. If we did not have a discriminator in our child list, we assume the structure is probably a primitive
			//    and so we show both what we have, and what we expect.

			let discriminators: string[] = [];

			for (let type of description.types) {
				if (type.kind === "object"
					&& "kind" in type.marshal
					&& (type.marshal as any).kind.kind === "constant"
				) {
					discriminators.push((type.marshal as any).kind.value);
				}
			}

			if (discriminators.length !== 0) {
				for (let err of errors) {
					if (err.rule !== "constant" || err.path.length !== path.length + 1) {
						throw err;
					}
				}

				if (typeof obj === "object" && "kind" in obj) {
					assertHere(
						false,
						`Unable to match against union.`
							+ ` Found "kind" discriminator: [${obj.kind}], but needed one of [${discriminators.join(" | ")}]`
					);
				} else {
					assertHere(
						false,
						`Unable to find "kind" discriminator. Expecting one of [${discriminators.join(" | ")}]`
					);
				}
			} else {
				assertHere(
					false,
					`Unable to match against union.`
						+ ` Provided ${util.inspect(obj)} but expected one of [${description.types.map(({ kind }) => kind).join(" | ")}]`
				);
			}

			break;
		}

		case "any":
		case "unknown": {
			break;
		}

		case "recursive": {
			marshal(obj, description.self, path);
			break;
		}

		case "logically-verified": {
			marshal(obj, description.spec, path);
			assertHere(description.fn(obj), `Failed user verification on: ${util.inspect(obj)}`);
			break;
		}

		case "witness": {
			marshal(obj, description.type, path);
			break;
		}

		case "dictionary": {
			assertHere(typeof obj === "object", `Expected dictionary, got ${typeof obj}`);
			assertHere(!("__proto__" in obj) || obj.__proto__ === Object.prototype, `Found prototype pollution`);
			Object.keys(obj).forEach((key) => marshal(obj[key], description.type, path.concat([key])));
			break;
		}

		default: unreachable(description);
	}
}

export namespace M {
	export let empty: MarshalUnion<{}> = { kind: "object", marshal: {} } as MarshalUnion<{}>;
	export let str: MarshalUnion<string> = { kind: "string" } as MarshalUnion<string>;
	export let bool: MarshalUnion<boolean> = { kind: "boolean" } as MarshalUnion<boolean>;
	export let num: MarshalUnion<number> = { kind: "number" } as MarshalUnion<number>;
	export let opt = <S>(type: MarshalUnion<S>): MarshalUnion<S | undefined> =>
		({ kind: "optional", type } as MarshalUnion<S | undefined>);
	export let array = <S>(type: MarshalUnion<S>): MarshalUnion<S[]> =>
		({ kind: "array", type } as MarshalUnion<S[]>);
	export let obj = <T extends {}>(ob: MarshalObject<T>) =>
		({
			kind: "object",
			marshal: ob
		}) as MarshalUnion<KeyFix<T>>;
	export let rec = <T>(f: (self: MarshalUnion<T>) => MarshalUnion<T>) => {
		let parent = { kind: "recursive", self: undefined } as any;
		parent.self = f(parent);
		return parent as MarshalUnion<T>;
	};
	export let constant = <C extends string | number | boolean | null>(value: C) =>
		({ kind: "constant", value } as MarshalUnion<C>);
	export let nul: MarshalUnion<null> = constant(null);
	export let all: MarshalUnion<any> = { kind: "any" };
	export let unknown: MarshalUnion<unknown> = { kind: "unknown" };
	export let fun = <T>(fn: (data: T) => boolean, spec: MarshalUnion<T>): MarshalUnion<T> =>
		({ kind: "logically-verified", fn, spec } as MarshalUnion<T>);
	export let witness = <T, U>(type: MarshalUnion<T>): MarshalUnion<T & {__typeWitness: U}> =>
		({ kind: "witness", type }) as MarshalUnion<T & { __typeWitness: U }>;
	export let dict = <S>(type: MarshalUnion<S>) =>
		({ kind: "dictionary", type }) as MarshalUnion<{ [key: string]: S }>;
	export function union<T extends any[]>(...arg: { [K in keyof T]: MarshalUnion<T[K]> }): MarshalUnion<T[number]> {
		return { kind: "union", types: arg } as any;
	}
	export function tup<T extends any[]>(...arg: { [K in keyof T]: MarshalUnion<T[K]> }): MarshalUnion<T> {
		return { kind: "tuple", type: arg } as any;
	}
}

export function withBody<T extends Pick<Request, keyof Request>, S>(
	description: MarshalUnion<S>,
	fn: (req: Omit<T, "body"> & { body: S }, res: Response) => void
) {
	return (req: T, res: Response) => {
		try {
			marshal(req.body, description);
		} catch (error) {
			if (error instanceof MarshalError) {
				error.message = `Invalid request body: ${error.message}`;
				throw error;
			} else {
				throw error;
			}
		}

		return fn(req, res);
	};
}

export function withQuery<T extends Pick<Request, keyof Request>, S>(
	description: MarshalUnion<S>,
	fn: (req: Omit<T, "query"> & { query: S }, res: Response) => void
) {
	return (req: T, res: Response) => {
		try {
			marshal(req.query, description);
		} catch (error) {
			if (error instanceof MarshalError) {
				error.message = `Invalid query parameters: ${error.message}`;
				throw error;
			} else {
				throw error;
			}
		}

		return fn(req, res);
	};
}
