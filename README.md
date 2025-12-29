# TypeSeq

**TypeSeq** is a compact, deterministic serialization format for flat JavaScript objects.

It encodes values together with explicit type aliases, producing stable and human-readable strings that can be decoded back into predictable runtime values. TypeSeq is designed for cases where JSON is too verbose, unstable, or ambiguous.

## Key characteristics

- **Type-aware**: each value carries its type (string, number, boolean, date, null)

- **Deterministic output**: keys are sorted, encoding is stable

- **Null-safe**: non-finite numbers decode as null

- **Undefined skipped**: undefined keys are omitted during encoding

- **TypeScript-friendly**: optional schema-based decoding with accurate inference

- **Readable**: plain-text format, easy to inspect and debug

## When to use TypeSeq

- Stable cache keys

- URL-safe or compact payload transport

- Deterministic hashing or signatures

- Simple protocols where full JSON is unnecessary

## When not to use it

- Nested or deeply structured data

- Binary-heavy payloads

- Cases that require full JSON compatibility

## Quick example

### Installation

`npm`

```bash
npm i typeseq
```

`yarn`

```bash
yarn add typeseq
```

### Encode

```ts
import { encode, decode, decodeWithSchema } from 'typeseq'

const payload = {
	name: 'Yanto Kopling',
	age: 27,
	score: NaN, // non-finite → null
	active: true,
	createdAt: new Date('2025-12-29T10:00:00Z'),
	note: undefined, // skipped
	deletedAt: null // explicit null
}

const encoded = encode(payload)
// active;b;true|age;n;27|createdAt;d;"2025-12-29T10:00:00.000Z"|deletedAt;x;|name;s;"Yanto Kopling"|score;n;
```

> Notes:

- Keys are sorted lexicographically to ensure deterministic output
- undefined values are omitted during encoding
- Non-finite numbers (NaN, Infinity) keep the n alias but encode with an empty value
- null is encoded explicitly using the x alias

### Decode

```ts
const decoded = decode(encoded)
/*
{
	name: 'Yanto Kopling',
	age: 27,
	score: null,
	active: true,
	createdAt: Date,
	deletedAt: null, 
}
*/
```

### With schema (TypeScript-safe)

```ts
const typed = decodeWithSchema(encoded, {
	name: 's',
	age: 'n',
	score: 'n',
	active: 'b',
	createdAt: 'd'
} as const)

/*
typed is inferred as:
{
  name: string
  age: number | null
  score: number | null
  active: boolean
  createdAt: Date
}
*/
```

> Notes:

- undefined keys are omitted during encoding
- non-finite numbers (NaN, Infinity) keep alias n and decode to null
- output is deterministic (sorted keys, stable format)

---
