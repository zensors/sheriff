<p align="center">
    <img src="https://zensors-public-content.s3.us-east-2.amazonaws.com/sheriff.png" width="400px">
</p>
<p align="center">
    Easy and type-safe input validation
</p>
<p align="center">
    <img src="https://badge.buildkite.com/663d9727d2a4056be90ba4731ba6a3a91a1adcd01e27d24c28.svg?branch=master">
    <a href="https://npmjs.com/package/@zensors/sheriff">
        <img alt="npm" src="https://img.shields.io/npm/v/@zensors/sheriff">
    </a>
    <img alt="npm type definitions" src="https://img.shields.io/npm/types/@zensors/sheriff">
</p>

-----

Validating user input is the most important way to protect your APIs. With Sheriff, you can easily describe what data should look like to avoid type confusion and other bugs.

## Features

- [x] 💪 Robust and well-tested marshaller
- [x] 🌐 Works with [express](https://expressjs.com/)
- [x] <img src="https://zensors-public-content.s3.us-east-2.amazonaws.com/ts-logo-128.png" height="16px"> Full TypeScript support
- [x] 🔢 Supports all JSON-serializable types
- [x] 🏭 Prevents prototype pollution
- [x] ⌨️ Allows custom validation functions

## Get Started

Getting started with sheriff is as simple as installing it with `npm` or `yarn`.

```
npm install --save @zensors/sheriff
```

or

```bash
yarn add @zensors/sheriff
```

## Example

```ts
import { M, marshal } from "@zensors/sheriff"

const description = M.obj({
    name: M.str,
    namespace: M.opt(M.str),
    types: M.arr(M.union(
        M.lit("TypeScript"),
        M.lit("Flow"),
    ))
});

const input = JSON.parse(`{
    "name": "sheriff",
    "namespace": "@zensors",
    "types": ["TypeScript"]
}`);

marshal(input, description);

console.log("input.name is now typed as string:", input.name);
```

## Usage

Sheriff is a declarative library for creating data specifications and validating them against untrusted input. Although it is primarily designed for securing APIs, it can also be used anywhere that data is validated.

Unlike most other data validation libraries, Sheriff is designed around TypeScript. As a result, when you marshal a value against a sheriff description, TypeScript will automatically know what the value's type is.

### Creating Marshallers

The `@zensors/sheriff` package exports a value called `M` which contains a large number of composable marshallers. The can be combined to create more complex marshallers.

For instance, if you wanted to create a marshaller for the type

```ts
type Example =
    | { kind: "person", name: string, age?: number }
    | { kind: "dog", goodness: number }
```

You could compose the marshallers like this:

```ts
const exampleMarshaller = M.union(
    M.obj({ kind: M.lit("person"), name: M.str, age: M.opt(M.num) }),
    M.obj({ kind: M.lit("dog"), goodness: M.num })
);
```

Additionally, you can also create your own custom marshallers using `M.custom`. For instance, if we wanted to ensure that all dogs have at least a 10/10 "goodness", we could change the marshaller to be

```ts
M.custom(M.num, (goodness) => {
    if (goodness < 10) {
        throw new Error("They're good dogs, Brent");
    }
});
```

For a complete list of all built-in marshallers, see [Api](#api).

### Marshalling

Given a marshaller, you can verify that an arbitray object matches it by using the `marshal` function from the `@zensors/sheriff` package.

The first argument of this function is the object that you want to marshal, and the second argument is the marshaller. If the object is described by the marshaller, then the function returns `undefined`. Otherwise, it will throw a `MarshalError` (also exported from `@zensors/sheriff`) with a description of what failed.

For TypeScript users, this function is typed as an assertion that the object inhabits the marshaller's type argument, which allows you to access the value in a type-safe manner.

## API

The package exports the following values:

- `M`: a collection of utility functions for constructing marshallers
- `marshal<T extends X, X = unknown>(obj: X, marshaller: Marshaller<T>, name: string = "INPUT"): asserts obj is T`: the function to marshal an object
- `MarshalError`: An `Error` that is raised by `marshal` when the object fails to marshal

Additionally, this package also exports the following type:

- `Marshaller<T>`: the type of a marshaller that marshals values of type `T`

### Built-in Marshallers

The `M` namespace provides the following utilities:

- `M.lit(value)`: a marshaller accepting the literal value `value` (primitives only)
- `M.bool`: a marshaller accepting all booleans
- `M.num`: a marshaller accepting all numbers
- `M.str`: a marshaller accepting all strings
- `M.opt(type)`: a marshaller that makes `type` optional (i.e. may be `undefined`)
- `M.obj(fields)`: given an object whose values are marshallers, produces a marshaller of an object with that structure
    - Note: attempting to marshal a value with excess keys will result in a marshalling error
	- Note: all fields that accept `undefined` as a value will be considered optional
- `M.arr(type)`: a marshaller that makes an array out of the marshaller `type`
- `M.tup(...fields)`: given any number of marshallers, produces a marshaller for a tuple consisting of the types specified by those marshallers in order
- `M.union(...types)`: given any number of marshallers, returns a marshaller that accepts values of any of the constituent marshaller types
- `M.rec(f)`: constructs a recursive marshaller
    - To use: pass a function that takes one parameter (`self`) and returns a marshaller
    - Note: if you are using TypeScript, you **must** provide a type argument to this function corresponding to the recursive type you wish to construct
- `M.any`: a marshaller accepting any input, resulting in the TS type `any`
	- Consider using `M.unk` instead for better typechecking
- `M.unk`: a marshaller accepting any input, resulting in the TS type `unknown`
- `M.custom(type, fn)`: extends the marshaller `type` with custom logic from `fn`
    - `fn` should throw an error if `type` is invalid, and return `undefined` otherwise.
- `M.record(type)`: marshals any object whose keys are strings, and whose values are described by `type`
- `M.witness(type)`: adds a brand to the resulting type
- `M.nul`: a marshaller accepting only `null`
- `M.undef`: a marshaller accepting only `undefined`
- `M.int`: a marshaller accepting only `number`s that are also integers

### Marshal Errors

The `MarshalError` class has the following properties:

- `name`: `string` - The name of the root object being marshalled
- `path`: `(string | number)[]` - The location within the input where the error occurred
- `info`: `string` - A description of why marshalling failed
- `rule`: `string` - The marshal rule that failed
- `message`: `string` - A human-readable description of the failure

## More Examples

### Tuples

```ts
import { M, marshal, Marshaller } from "@zensors/sheriff";

export const triple = <T>(marshaller: Marshaller<T>) =>
    M.tup(marshaller, marshaller, marshaller);

const data = JSON.parse(`[1, 2, 3]`);

marshal(data, triple(M.num));
```

### Binary Search Tree

```ts
import { M } from "@zensors/sheriff"

type BST = {
    value: number;
    left?: BST;
    right?: BST;
};

export const BSTMarshaller =
    M.rec<BST>((bst) =>
        M.custom(
			M.obj({ value: M.num, left: M.opt(bst), right: M.opt(bst) }),
			({ value, left, right }) => {
				if (left && left.value > value) {
					throw new Error("Left value must be less than current value");
				}
				if (right && right.value < value) {
					throw new Error("Right value must be greater than current value");
				}
			}
		)
    );
```

### Express

```ts
import express from "express";
import bodyParser from "bodyParser";
import { M, marshal } from "@zensors/sheriff";

const app = express();
app.use(bodyParser.json());

app.get("/api/upload-dog", (req, res) => {
    const query = req.query as unknown;
    const body = req.query as unknown;

    marshal(query, M.obj({ apiKey: M.str }));
    marshal(body, M.obj({
        name: M.str,
        age: M.int,
        gender: M.union(M.lit("male"), M.lit("female"), M.lit("other")),
    }));

    createDog(query.apiKey, body);
    res.send("Ok");
});
```

### Expedite

```ts
import { Router, marshalBody, marshalQuery } from "@zensors/expedite";
import { M } from "@zensors/sheriff";
import bodyParser from "bodyParser";

const router = (new Router())
    .use(bodyParser.json())
    .then(marshalQuery(M.obj({ apiKey: M.str })));

router.get("/api/upload-dog")
    .then(marshalBody(M.obj({
        name: M.str,
        age: M.str,
        gender: M.union(M.lit("male"), M.lit("female"), M.lit("other")),
    })))
    .return((req) => {
        createDog(req.query.apiKey, req.body);
        return "Ok";
    })
```

## Contributions

Bug reports and feature requests can be submitted through the issues tab. Unfortunately, Sheriff is not accepting code contributions at this moment.

## Credit

This project is developed and maintained by [Zensors, Inc.](https://zensors.com).