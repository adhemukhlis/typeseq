export type TypeAlias = 's' | 'n' | 'b' | 'd'
export type SupportedValue = string | number | boolean | Date
export type FlatPayloadObject = Record<string, SupportedValue>

const TYPE_TO_ALIAS = {
	string: 's',
	number: 'n',
	boolean: 'b',
	date: 'd'
} as const satisfies Record<'string' | 'number' | 'boolean' | 'date', TypeAlias>

type SchemaValue = TypeAlias | { type: TypeAlias; optional?: boolean }

export type FlatPayloadSchema<T extends Record<string, any>> = {
	[K in keyof T]-?: SchemaValue
}

const ALIAS_TO_PARSER: Record<TypeAlias, (raw: string) => SupportedValue> = {
	s: (raw) => {
		const trimmed = raw.trim()
		if (trimmed.startsWith('"') && trimmed.endsWith('"')) return JSON.parse(trimmed) as string
		return trimmed
	},
	n: (raw) => {
		const num = Number(raw.trim())
		if (!Number.isFinite(num)) throw new Error(`Invalid number: ${raw}`)
		return num
	},
	b: (raw) => {
		const v = raw.trim().toLowerCase()
		if (v === 'true') return true
		if (v === 'false') return false
		throw new Error(`Invalid boolean: ${raw}`)
	},
	d: (raw) => {
		const trimmed = raw.trim()
		const str = trimmed.startsWith('"') && trimmed.endsWith('"') ? (JSON.parse(trimmed) as string) : trimmed

		const dt = new Date(str)
		if (Number.isNaN(dt.getTime())) throw new Error(`Invalid date: ${raw}`)
		return dt
	}
} as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false
	if (Array.isArray(value)) return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

function splitOutsideQuotes(input: string, sepChar: string): string[] {
	const out: string[] = []
	let buf = ''
	let inQuotes = false
	let escaped = false

	for (let i = 0; i < input.length; i++) {
		const ch = input[i]!

		if (escaped) {
			buf += ch
			escaped = false
			continue
		}
		if (ch === '\\') {
			buf += ch
			escaped = true
			continue
		}
		if (ch === '"') {
			buf += ch
			inQuotes = !inQuotes
			continue
		}
		if (!inQuotes && ch === sepChar) {
			out.push(buf)
			buf = ''
			continue
		}
		buf += ch
	}

	out.push(buf)
	return out
}

function inferAlias(value: SupportedValue): TypeAlias {
	if (value instanceof Date) return TYPE_TO_ALIAS.date

	const t = typeof value
	if (t === 'string') return TYPE_TO_ALIAS.string
	if (t === 'number') return TYPE_TO_ALIAS.number
	if (t === 'boolean') return TYPE_TO_ALIAS.boolean
	throw new Error(`Unsupported type: ${String(t)}`)
}

function encodeValue(alias: TypeAlias, key: string, value: SupportedValue): string {
	if (alias === 's') {
		return JSON.stringify(value)
	}
	if (alias === 'n') {
		const n = value as number
		if (!Number.isFinite(n)) throw new Error(`Non-finite number for "${key}"`)
		return String(n)
	}
	if (alias === 'b') {
		return (value as boolean) ? 'true' : 'false'
	}
	if (alias === 'd') {
		if (!(value instanceof Date)) throw new Error(`Expected Date for "${key}"`)
		return JSON.stringify(value.toISOString())
	}
	const _never: never = alias
	throw new Error(`Unknown alias: ${_never}`)
}

export function encodeFlatPayload<T extends FlatPayloadObject>(obj: T): string {
	if (!isPlainObject(obj)) {
		throw new Error('encodeFlatPayload expects a flat plain object')
	}

	const keys = Object.keys(obj).sort()
	const rows: string[] = []

	for (const key of keys) {
		const raw = (obj as Record<string, SupportedValue>)[key]
		const alias = inferAlias(raw)
		const encodedValue = encodeValue(alias, key, raw)
		rows.push(`${key};${alias};${encodedValue}`)
	}

	return rows.join('|')
}

export function decodeFlatPayload(str: string): FlatPayloadObject {
	if (typeof str !== 'string') throw new Error('decodeFlatPayload expects string')

	const result: FlatPayloadObject = {}
	const rows = splitOutsideQuotes(str, '|').filter((r) => r.length > 0)

	for (const row of rows) {
		const parts = splitOutsideQuotes(row, ';')
		if (parts.length !== 3) throw new Error(`Invalid row (expected 3 parts): ${row}`)

		const [keyRaw, typeRaw, valueRaw] = parts
		const key = keyRaw.trim()
		const type = typeRaw.trim() as TypeAlias

		if (!key) throw new Error(`Empty key in row: ${row}`)
		const parser = (ALIAS_TO_PARSER as Record<string, (raw: string) => SupportedValue>)[type]
		if (!parser) throw new Error(`Unknown type alias "${typeRaw.trim()}" in row: ${row}`)

		result[key] = parser(valueRaw)
	}

	return result
}

function normalizeSchemaValue(v: SchemaValue): { type: TypeAlias; optional: boolean } {
	if (typeof v === 'string') return { type: v, optional: false }
	return { type: v.type, optional: Boolean(v.optional) }
}

type InferSchemaType<V extends SchemaValue> = V extends 's'
	? string
	: V extends 'n'
		? number
		: V extends 'b'
			? boolean
			: V extends 'd'
				? Date
				: V extends { type: infer T; optional?: infer O }
					? T extends TypeAlias
						? O extends true
							? T extends 's'
								? string | undefined
								: T extends 'n'
									? number | undefined
									: T extends 'b'
										? boolean | undefined
										: T extends 'd'
											? Date | undefined
											: never
							: T extends 's'
								? string
								: T extends 'n'
									? number
									: T extends 'b'
										? boolean
										: T extends 'd'
											? Date
											: never
						: never
					: never

export type InferFromSchema<S extends Record<string, SchemaValue>> = {
	[K in keyof S]: InferSchemaType<S[K]>
}

export function decodeFlatPayloadWithSchema<S extends Record<string, SchemaValue>>(
	str: string,
	schema: S
): InferFromSchema<S> {
	const raw = decodeFlatPayload(str)

	const out: Record<string, any> = {}

	for (const k of Object.keys(schema)) {
		const { type: expectedType, optional } = normalizeSchemaValue(schema[k]!)

		if (!(k in raw)) {
			if (optional) {
				out[k] = undefined
				continue
			}
			throw new Error(`Missing required key "${k}"`)
		}

		const val = raw[k]
		const actualAlias = inferAlias(val)

		if (actualAlias !== expectedType) {
			throw new Error(`Type mismatch for "${k}": expected ${expectedType} but got ${actualAlias}`)
		}

		out[k] = val
	}

	return out as InferFromSchema<S>
}

export const parsers = ALIAS_TO_PARSER
export const typeToAlias = TYPE_TO_ALIAS
export const split = splitOutsideQuotes
