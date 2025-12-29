type TypeAlias = 's' | 'n' | 'b' | 'd' | 'x';
type SupportedValue = string | number | boolean | Date | null;
type FlatPayloadObject = Record<string, SupportedValue>;
type SchemaValue = TypeAlias | {
    type: TypeAlias;
    optional?: boolean;
};
type EncodableValue = SupportedValue | undefined;
declare function encode<T extends Record<string, EncodableValue>>(obj: T): string;
declare function decode(str: string): FlatPayloadObject;
type AliasToType<A extends TypeAlias> = A extends 's' ? string : A extends 'n' ? number | null : A extends 'b' ? boolean : A extends 'd' ? Date : A extends 'x' ? null : never;
type InferSchemaType<V extends SchemaValue> = V extends TypeAlias ? AliasToType<V> : V extends {
    type: infer T;
    optional?: infer O;
} ? T extends TypeAlias ? O extends true ? AliasToType<T> | undefined : AliasToType<T> : never : never;
type InferFromSchema<S extends Record<string, SchemaValue>> = {
    [K in keyof S]: InferSchemaType<S[K]>;
};
declare function decodeWithSchema<const S extends Record<string, SchemaValue>>(str: string, schema: S): InferFromSchema<S>;

export { type FlatPayloadObject, type SupportedValue, type TypeAlias, decode, decodeWithSchema, encode };
