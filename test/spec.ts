import { expect } from "chai";

import { M, marshal, Marshaller } from "../src";

describe("@zensors/sheriff", () => {
	describe("marshal", () => {
		it("should use the user-provided name in validation errors if one is provided", () => {
			expect(() => marshal({ foo: "bar" } as unknown, M.obj({ foo: M.num }), "body"))
				.to.throw("[At body.foo]: Expected number, got string");
		});

		describe("literal case", () => {
			it("should accept exact matches", () => {
				marshal(1 as unknown, M.lit(1));
			});

			it("should reject other values of the same type", () => {
				expect(() => marshal(2 as unknown, M.lit(1)))
					.to.throw("[At INPUT]: Expected constant value 1, got 2");
			});

			it("should reject values of other types", () => {
				expect(() => marshal("1" as unknown, M.lit(1)))
					.to.throw("[At INPUT]: Expected constant value 1, got 1");
			});
		});

		describe("boolean case", () => {
			it("should accept true", () => {
				marshal(true as unknown, M.bool);
			});

			it("should accept false", () => {
				marshal(false as unknown, M.bool);
			});

			it("should reject numbers", () => {
				expect(() => marshal(1 as unknown, M.bool))
					.to.throw("[At INPUT]: Expected boolean, got number");
			});

			it("should reject strings", () => {
				expect(() => marshal("true" as unknown, M.bool))
					.to.throw("[At INPUT]: Expected boolean, got string");
			});

			it("should reject objects", () => {
				expect(() => marshal({ foo: true } as unknown, M.bool))
					.to.throw("[At INPUT]: Expected boolean, got object");
			});

			it("should reject arrays", () => {
				expect(() => marshal([true] as unknown, M.bool))
					.to.throw("[At INPUT]: Expected boolean, got object");
			});

			it("should reject undefined", () => {
				expect(() => marshal(undefined as unknown, M.bool))
					.to.throw("[At INPUT]: Expected boolean, got undefined");
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, M.bool))
					.to.throw("[At INPUT]: Expected boolean, got object");
			});
		});

		describe("number case", () => {
			it("should reject booleans", () => {
				expect(() => marshal(true as unknown, M.num))
					.to.throw("[At INPUT]: Expected number, got boolean");
			});

			it("should accept numbers", () => {
				marshal(1 as unknown, M.num);
			});

			it("should reject strings", () => {
				expect(() => marshal("1" as unknown, M.num))
					.to.throw("[At INPUT]: Expected number, got string");
			});

			it("should reject objects", () => {
				expect(() => marshal({ foo: 1 } as unknown, M.num))
					.to.throw("[At INPUT]: Expected number, got object");
			});

			it("should reject arrays", () => {
				expect(() => marshal([1] as unknown, M.num))
					.to.throw("[At INPUT]: Expected number, got object");
			});

			it("should reject undefined", () => {
				expect(() => marshal(undefined as unknown, M.num))
					.to.throw("[At INPUT]: Expected number, got undefined");
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, M.num))
					.to.throw("[At INPUT]: Expected number, got object");
			});
		});

		describe("string case", () => {
			it("should reject booleans", () => {
				expect(() => marshal(true as unknown, M.str))
					.to.throw("[At INPUT]: Expected string, got boolean");
			});

			it("should reject numbers", () => {
				expect(() => marshal(1 as unknown, M.str))
					.to.throw("[At INPUT]: Expected string, got number");
			});

			it("should accept strings", () => {
				marshal("1" as unknown, M.str);
			});

			it("should reject objects", () => {
				expect(() => marshal({ foo: 1 } as unknown, M.str))
					.to.throw("[At INPUT]: Expected string, got object");
			});

			it("should reject arrays", () => {
				expect(() => marshal([1] as unknown, M.str))
					.to.throw("[At INPUT]: Expected string, got object");
			});

			it("should reject undefined", () => {
				expect(() => marshal(undefined as unknown, M.str))
					.to.throw("[At INPUT]: Expected string, got undefined");
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, M.str))
					.to.throw("[At INPUT]: Expected string, got object");
			});
		});

		describe("optional case", () => {
			it("should accept undefined", () => {
				marshal(undefined as unknown, M.opt(M.num));
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, M.opt(M.num)))
					.to.throw("[At INPUT]: Expected number, got object");
			});

			it("should accept anything accepted by the base marshaller", () => {
				marshal(1 as unknown, M.opt(M.num));
			});

			it("should reject anything rejected by the base marshaller", () => {
				expect(() => marshal("1" as unknown, M.opt(M.num)))
					.to.throw("[At INPUT]: Expected number, got string");
			});
		});

		describe("object case", () => {
			const marshaller = M.obj({ foo: M.num, bar: M.str });

			it("should reject booleans", () => {
				expect(() => marshal(true as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got boolean");
			});

			it("should reject numbers", () => {
				expect(() => marshal(1 as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got number");
			});

			it("should reject strings", () => {
				expect(() => marshal("1" as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got string");
			});

			it("should reject JSON.parse'd objects with an overwritten __proto__ field", () => {
				expect(() => marshal(JSON.parse('{ "__proto__": 1, "foo": 1, "bar": "hi" }') as unknown, marshaller))
					.to.throw("[At INPUT]: Encountered prototype pollution");
			});

			it("should reject standard objects with an overwritten __proto__ field", () => {
				expect(() => marshal({ __proto__: [], foo: 1, bar: "hi" } as unknown, marshaller))
					.to.throw("[At INPUT]: Encountered prototype pollution");
			});

			it("should reject objects whose fields are incorrect", () => {
				expect(() => marshal({ foo: 1, bar: false } as unknown, marshaller))
					.to.throw("[At INPUT.bar]: Expected string, got boolean");
			});

			it("should reject objects that are missing fields", () => {
				expect(() => marshal({ foo: 1 } as unknown, marshaller))
					.to.throw("[At INPUT.bar]: Expected string, got undefined");
			});

			it("should reject objects with excess fields", () => {
				expect(() => marshal({ foo: 1, bar: "hi", baz: true } as unknown, marshaller))
					.to.throw("[At INPUT]: Found unexpected key: baz");
			});

			it("should accept objects matching the marshaller", () => {
				marshal({ foo: 1, bar: "hi" } as unknown, marshaller);
			});

			it("should reject arrays", () => {
				expect(() => marshal([1] as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got array");
			});

			it("should reject undefined", () => {
				expect(() => marshal(undefined as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got undefined");
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got null");
			});
		});

		describe("array case", () => {
			const marshaller = M.arr(M.num);

			it("should reject booleans", () => {
				expect(() => marshal(true as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got boolean");
			});

			it("should reject numbers", () => {
				expect(() => marshal(1 as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got number");
			});

			it("should reject strings", () => {
				expect(() => marshal("1" as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got string");
			});

			it("should reject objects", () => {
				expect(() => marshal({ "0": 1 } as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got object");
			});

			it("should reject JSON.parse'd objects with attempted prototype pollution", () => {
				expect(() => marshal(JSON.parse('{ "__proto__": [], "0": 1 }') as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got object");
			});

			it("should reject standard objects with attempted prototype pollution", () => {
				expect(() => marshal({ __proto__: [], "0": 1 } as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got object");
			});

			it("should accept empty arrays", () => {
				marshal([] as unknown, marshaller);
			});

			it("should reject nonempty arrays with any elements not matching the base marshaller", () => {
				expect(() => marshal([1, 2, "3", 4, 5] as unknown, marshaller))
					.to.throw("[At INPUT[2]]: Expected number, got string");
			});

			it("should accept nonempty arrays in which all elements match the base marshaller", () => {
				marshal([1, 2, 3, 4, 5] as unknown, marshaller);
			});

			it("should reject undefined", () => {
				expect(() => marshal(undefined as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got undefined");
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, marshaller))
					.to.throw("[At INPUT]: Expected array, got object");
			});
		});

		describe("tuple case", () => {
			const marshaller = M.tup(M.num, M.str);

			it("should reject booleans", () => {
				expect(() => marshal(true as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got boolean");
			});

			it("should reject numbers", () => {
				expect(() => marshal(1 as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got number");
			});

			it("should reject strings", () => {
				expect(() => marshal("1" as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got string");
			});

			it("should reject objects", () => {
				expect(() => marshal({ "0": 1, "1": "foo" } as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got object");
			});

			it("should reject JSON.parse'd objects with attempted prototype pollution", () => {
				expect(() => marshal(JSON.parse('{ "__proto__": [], "0": 1, "1": "foo" }') as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got object");
			});

			it("should reject standard objects with attempted prototype pollution", () => {
				expect(() => marshal({ __proto__: [], "0": 1, "1": "foo" } as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got object");
			});

			it("should reject tuples with the wrong length", () => {
				expect(() => marshal([] as unknown, marshaller))
					.to.throw("[At INPUT]: Invalid tuple size: Expected 2, got 0");
			});

			it("should reject tuples with the wrong length", () => {
				expect(() => marshal([1, "foo", 2] as unknown, marshaller))
					.to.throw("[At INPUT]: Invalid tuple size: Expected 2, got 3");
			});

			it("should reject tuples of the correct length with any elements not matching their marshallers", () => {
				expect(() => marshal([1, 2] as unknown, marshaller))
					.to.throw("[At INPUT[1]]: Expected string, got number");
			});

			it("should accept tuples of the correct length whose elements match their marshallers", () => {
				marshal([1, "foo"] as unknown, marshaller);
			});

			it("should accept tuples of the correct length whose elements match their marshallers", () => {
				marshal([] as unknown, M.tup());
			});

			it("should reject undefined", () => {
				expect(() => marshal(undefined as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got undefined");
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, marshaller))
					.to.throw("[At INPUT]: Expected tuple, got object");
			});
		});

		describe("union case", () => {
			const discriminatedMarshaller = M.union(
				M.obj({ kind: M.lit("foo"), foo: M.num }),
				M.obj({ kind: M.lit("bar"), bar: M.str })
			);

			const undiscriminatedMarshaller = M.union(
				M.obj({ foo: M.num }),
				M.obj({ bar: M.str })
			);

			it("should accept discriminated objects matching any of its base marshallers", () => {
				marshal({ kind: "foo", foo: 1 } as unknown, discriminatedMarshaller);
			});

			it("should accept discriminated objects matching any of its base marshallers", () => {
				marshal({ kind: "bar", bar: "hi" } as unknown, discriminatedMarshaller);
			});

			it("should reject discriminated objects that have an invalid discriminator value", () => {
				expect(() => marshal({ kind: "baz", baz: false } as unknown, discriminatedMarshaller))
					.to.throw('[At INPUT]: Unable to match against union. Found "kind" discriminator: [baz], but needed one of [foo | bar]');
			});

			it("should reject discriminated objects that have are missing the discriminator", () => {
				expect(() => marshal({ baz: false } as unknown, discriminatedMarshaller))
					.to.throw('[At INPUT]: Unable to find "kind" discriminator. Expecting one of [foo | bar]');
			});

			it("should reject discriminated objects that have a valid discriminator value but which do not otherwise match the corresponding base marshaller", () => {
				expect(() => marshal({ kind: "foo", bar: 1 } as unknown, discriminatedMarshaller))
					.to.throw("[At INPUT.foo]: Expected number, got undefined");
			});

			it("should accept undiscriminated objects matching any of its base marshallers", () => {
				marshal({ foo: 1 } as unknown, undiscriminatedMarshaller);
			});

			it("should accept undiscriminated objects matching any of its base marshallers", () => {
				marshal({ bar: "hi" } as unknown, undiscriminatedMarshaller);
			});

			it("should reject undiscriminated objects not matching any of its base marshallers", () => {
				expect(() => marshal({ baz: false } as unknown, undiscriminatedMarshaller))
					.to.throw("[At INPUT]: Unable to match against union. Expected one of [object | object]");
			});
		});

		describe("recursive case", () => {
			it("should accept anything accepted by its base marshaller", () => {
				marshal(1, M.rec(() => M.num));
			});

			it("should reject anything rejected by its base marshaller", () => {
				expect(() => marshal("1" as unknown, M.rec(() => M.num)))
					.to.throw("[At INPUT]: Expected number, got string");
			});

			interface Tree {
				value: number;
				left?: Tree;
				right?: Tree;
			}

			const treeMarshaller = M.rec<Tree>((self) => M.obj({ value: M.num, left: M.opt(self), right: M.opt(self) }));

			it("should accept anything accepted by its base marshaller", () => {
				marshal({
					value: 5,
					left: {
						value: 2,
						right: {
							value: 3
						}
					},
					right: {
						value: 8,
						left: {
							value: 6
						},
						right: {
							value: 10
						}
					}
				} as unknown, treeMarshaller);
			});

			it("should reject anything rejected by its base marshaller", () => {
				expect(() =>
					marshal({
						value: 5,
						left: {
							value: 2,
							right: {
								value: 3,
								wat: "hi"
							}
						},
						right: {
							value: 8,
							left: {
								value: 6
							},
							right: {
								value: 10
							}
						}
					} as unknown, treeMarshaller)
				).to.throw("[At INPUT.left.right]: Found unexpected key: wat");
			});
		});

		describe("any case", () => {
			it("should accept booleans", () => {
				marshal(true as unknown, M.any);
			});

			it("should accept numbers", () => {
				marshal(1 as unknown, M.any);
			});

			it("should accept strings", () => {
				marshal("hi" as unknown, M.any);
			});

			it("should accept objects", () => {
				marshal({ foo: "bar" } as unknown, M.any);
			});

			it("should accept arrays", () => {
				marshal([1, true] as unknown, M.any);
			});

			it("should accept undefined", () => {
				marshal(undefined as unknown, M.any);
			});

			it("should accept null", () => {
				marshal(null as unknown, M.any);
			});
		});

		describe("unknown case", () => {
			it("should accept booleans", () => {
				marshal(true as unknown, M.unk);
			});

			it("should accept numbers", () => {
				marshal(1 as unknown, M.unk);
			});

			it("should accept strings", () => {
				marshal("hi" as unknown, M.unk);
			});

			it("should accept objects", () => {
				marshal({ foo: "bar" } as unknown, M.unk);
			});

			it("should accept arrays", () => {
				marshal([1, true] as unknown, M.unk);
			});

			it("should accept undefined", () => {
				marshal(undefined as unknown, M.unk);
			});

			it("should accept null", () => {
				marshal(null as unknown, M.unk);
			});
		});

		describe("custom case", () => {
			const marshaller = M.custom(M.str, (arg) => {
				if (!arg.startsWith("foo")) {
					throw new Error(`${arg} doesn't start with "foo"`);
				}
			});

			it("should accept anything accepted by the validation function", () => {
				marshal("foobar", marshaller);
			});

			it("should reject anything rejected by the validation function", () => {
				expect(() => marshal("barfoo", marshaller))
					.to.throw(`[At INPUT]: barfoo doesn't start with "foo"`);
			});

			it("should reject if the validation function returns anything other than undefined", () => {
				expect(() => marshal("barfoo", M.custom(M.str, () => 1)))
					.to.throw(`[At INPUT]: Custom validation function unexpectedly returned a value`);
			});
		});

		describe("record case", () => {
			const marshaller = M.record(M.str);

			it("should reject booleans", () => {
				expect(() => marshal(true as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got boolean");
			});

			it("should reject numbers", () => {
				expect(() => marshal(1 as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got number");
			});

			it("should reject strings", () => {
				expect(() => marshal("1" as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got string");
			});

			it("should reject JSON.parse'd objects with an overwritten __proto__ field", () => {
				expect(() => marshal(JSON.parse('{ "__proto__": "hi", "foo": "hi", "bar": "hi" }') as unknown, marshaller))
					.to.throw("[At INPUT]: Encountered prototype pollution");
			});

			it("should reject standard objects with an overwritten __proto__ field", () => {
				expect(() => marshal({ __proto__: [], foo: "hi", bar: "hi" } as unknown, marshaller))
					.to.throw("[At INPUT]: Encountered prototype pollution");
			});

			it("should reject objects containing any field not matching the base marshaller", () => {
				expect(() => marshal({ foo: "hi", bar: false } as unknown, marshaller))
					.to.throw("[At INPUT.bar]: Expected string, got boolean");
			});

			it("should accept objects containing only fields matching the base marshaller", () => {
				marshal({ foo: "hi", bar: "there" } as unknown, marshaller);
			});

			it("should reject arrays", () => {
				expect(() => marshal([1] as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got array");
			});

			it("should reject undefined", () => {
				expect(() => marshal(undefined as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got undefined");
			});

			it("should reject null", () => {
				expect(() => marshal(null as unknown, marshaller))
					.to.throw("[At INPUT]: Expected object, got null");
			});
		});

		describe("witness case", () => {
			const marshaller = M.witness<{ foo: string }, "FooBrand">(M.obj({ foo: M.str }));

			it("should accept anything accepted by its base marshaller", () => {
				marshal({ foo: "bar" } as unknown, marshaller);
			});

			it("should reject anything rejected by its base marshaller", () => {
				expect(() => marshal({ foo: 1 } as unknown, marshaller))
					.to.throw("[At INPUT.foo]: Expected string, got number");
			});
		});
	});

	describe("M", () => {
		describe("int", () => {
			it("should reject anything that isn't a number", () => {
				expect(() => marshal("1" as unknown, M.int))
					.to.throw("[At INPUT]: Expected number, got string");
			});

			it("should reject floats", () => {
				expect(() => marshal(1.23 as unknown, M.int))
					.to.throw("[At INPUT]: Expected integer, got non-integer");
			});

			it("should reject NaN", () => {
				expect(() => marshal(NaN as unknown, M.int))
					.to.throw("[At INPUT]: Expected integer, got non-integer");
			});

			it("should reject Infinity", () => {
				expect(() => marshal(Infinity as unknown, M.int))
					.to.throw("[At INPUT]: Expected integer, got non-integer");
			});

			it("should accept numbers that are integers", () => {
				marshal(1 as unknown, M.int);
			});
		})
	});
});
