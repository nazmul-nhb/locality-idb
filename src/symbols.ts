/** Symbol key for column data type */
export const ColumnType = Symbol('ColumnType');
/** Symbol key for primary key marker */
export const IsPrimaryKey = Symbol('IsPrimaryKey');
/** Symbol key for auto increment marker */
export const IsAutoInc = Symbol('IsAutoInc');
/** Symbol key for optional marker */
export const IsOptional = Symbol('IsOptional');
/** Symbol key for nullable (null) marker */
export const IsNullable = Symbol('IsNullable');
/** Symbol key for indexed marker */
export const IsIndexed = Symbol('IsIndexed');
/** Symbol key for unique marker */
export const IsUnique = Symbol('IsUnique');
/** Symbol key for default value */
export const DefaultValue = Symbol('DefaultValue');
/** Symbol key for custom validation function */
export const ValidateFn = Symbol('ValidateFn');
/** Symbol key for on update marker */
export const OnUpdate = Symbol('OnUpdate');

/** Symbol for type extraction (exists only in type system) */
export const Selected = Symbol('Selected');

/** Symbol to indicate if insert data is array */
export const IsArray = Symbol('IsArray');
