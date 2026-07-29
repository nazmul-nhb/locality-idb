# Changelog

All notable changes to **locality-idb** will be documented here.

> Auto-generated from [GitHub Releases](https://github.com/nazmul-nhb/locality-idb/releases).

## [v2.6.3](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.6.3) — 2026-07-29

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.6.1...v2.6.3)

* `🔧 update(scripts):` updated changelog generator
* `🐛 fix(select):` optimized `SelectQuery.page()`

## [v2.6.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.6.1) — 2026-07-28

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.6.0...v2.6.1)

* `🧼 refactor(iterables):` optimized loops for `DOMStringList` and updated docs
* `📚 docs(intro):` updated comparison table
* `🧹 cleanup(docs):` removed twoslash
* `🔧 update(docs):` added twoslash support and added a comparison table
* `📚 docs(list):` fixed list rendering issue
* `🔧 update(changelog):` updated changelog: include all the releases except the very first 2 demo ones

## [v2.6.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.6.0) — 2026-07-23

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.5.0...v2.6.0)

* `🛠️ chore:` updated pnpm config
* `📚 docs:` updated tsdoc for some of the methods of `Locality` class
* `🧹 cleanup:` cleaned node_modules and pnpm lockfile
* `✨ feat(utils):` added new utility: `getDatabaseList()` with docs
* `✨ feat(utils):` added new utils: `formatBytes()` and `getStorageUsage()` with docs; fixed issues with converting values to quoted string
* `📚 docs(future):` updated FUTURE.md
* `🔧 update(docs):` re-arranged and renamed top level nav and sidebar items
* `📚 docs:` updated FUTURE.md, CHANGELOG.md and vocs config
* `📚 docs:` updated homepage card title and vocs config
* `🔧 update(docs):` updated changelog generator with octokit
* `📚 docs(home):` reverted the installation commands section with mdx extension
* `🔧 update(docs):` updated the homepage contents

## [v2.5.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.5.0) — 2026-07-22

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.4.1...v2.5.0)

* `🔧 update(docs):` updated documentation, README.md, and FUTURE.md
* Merge pull request #2 from nazmul-nhb/feat/ref
* `🧼 refactor(ref):` reuse common code blocks; updated some logs in the demo app
* `🧼 refactor(demo):` refactored the html template strings and removed bun and deno commands from docs homepage
* `🐛 fix(demo):` fixed spacing and linting issues
* `🐛 fix(demo):` fixed issues with tabs and modals
* `🐛 fix(ref):` fixed getting related table name issue and other issues
* `🔧 update(demo):` updated ui, refactored code and added icons
* `🧼 refactor(demo):` completely redesigned the demo app
* `🛠️ chore:` optimized deps for docs and demo
* `🔧 update(demo):` improved the demo app
* `✨ feat(column):` added default value callback param and removed the literal generic type for default value; updated docs
* `🔧 update(docs+demo):` updated docs for ref and redesigned the demo app
* `🔧 update:` updated docs and refactored some validations
* `🧼 refactor(query):` created common base query to optimize the bundle size
* `✨ feat(ref):` added rf validation for insert query
* `🧼 refactor(ref):` optimized variable names and syntax
* `🧹 cleanup:` removed plans file
* `✨ feat(ref):` implemented ref in update and delete queries
* `✨ feat(ref):` added column modifier `ref()` with proper type inference with `defineSchema()`
* `📦 deps:` updated deps and configs
* `🐛 fix(docs):` updated library list using tailwind css
* `🔧 update(docs):` added reference to related libraries
* `🔧 update(docs):` updated examples and callouts

## [v2.4.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.4.1) — 2026-07-12

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.4.0...v2.4.1)

* `🔧 update(docs):` updated intro pages and README.md
* `🔧 update(docs):` added homepage and more links
* `🔧 update(docs):` polished the docs
* `🔧 update(docs):` added icon, logo and vocs generated changelog generator
* `🔧 update(scripts):` updated changelog generator script and README.md
* `🔧 update(docs):` added scripts to generate and update changelogs
* `✨ feat(docs):` added boilerplate doc site from README.md with Vocs
* `🔧 update(docs):` updated README.md and future plans

## [v2.4.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.4.0) — 2026-07-10

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.2.10...v2.4.0)

* `🧼 refactor(select):` optimized all the aggregation methods along with the previous find methods
* `📚 docs(select):` added docs and tsdoc for newly added methods
* `✨ feat(select):` added new method `distinct()` to get the array of distinct values of a column
* `✨ feat(select):` added new `avg()` method to calculate average for the selected column
* `✨ feat(select):` added new method `sum()` to calculate the sum of specific column
* `🐛 fix(select):` return immutable instances when immutable instances are needed
* `🐛 fix(update):` fixed issue with `set()` where return value of the callback was not checked properly in type level
* `✨ feat(update):` added new overload for `set()` method to receive current value of the row for computed update
* `🧼 refactor(query):` split queries into multiple files
* `🛠️ chore(demo):` replaced eslint-prettier with biome

## [v2.2.10](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.2.10) — 2026-07-09

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.2.4...v2.2.10)

* `🐛 fix(types):` properly infer nullable and optional fields for uuid and timestamp column types

## [v2.2.4](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.2.4) — 2026-07-08

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.2.2...v2.2.4)

* `🐛 fix(schema):` fixed issues with type inference and do not auto generate value if optional or nullable

## [v2.2.2](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.2.2) — 2026-07-08

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.2.1...v2.2.2)

* `🐛 fix(types):` fixed issues with uuid and timestamp column modifier inferences

## [v2.2.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.2.1) — 2026-07-08

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.2.0...v2.2.1)

* `📚 docs:` updated README.md and some tsdoc

## [v2.2.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.2.0) — 2026-07-08

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.1.0...v2.2.0)

* `🔧 update(types):` added constraints to `defineSchema` parameter type
* `🐛 fix(types):` updated the types of `validate` and `onUpdate` to properly reflect `nullable` and `optional` column types
* `🐛 fix(validator):` do not store modified value to solve issue with validation
* `✨ feat(core):` implemented nullable column modifier with proper types and validation logic
* `🔧 update(types):` updated type system
* `📚 docs:` added future plans
* `🔧 update(type):` updated type system

## [v2.1.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.1.0) — 2026-07-02

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.0.1...v2.1.0)

* `🔧 update(types):` added new type `ImportMode` for `ImportOptions`
* `🔧 update(types):` updated `ExportData` interface

## [v2.0.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.0.1) — 2026-07-02

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v2.0.0...v2.0.1)

* `🧼 refactor(types):` reused types from `toolbox-x` and re-exported them

## [v2.0.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v2.0.0) — 2026-06-29

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.10...v2.0.0)

* `🐛 fix(client):` renamed `export()` and `import()` methods to `$export()` and `$import()` to avoid conflicts
* `🔧 update(configs):` updated deps and linter+formatter

## [v1.5.10](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.10) — 2026-02-22

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.8...v1.5.10)

* `📚 docs(README.md):` updated a mismatched `Notes` section

## [v1.5.8](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.8) — 2026-02-21

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.7...v1.5.8)

* `🐛 fix(types):` fixed an unintentional swap issue (#1) for `IndexKeyType` and `UniqueKeyType`

## [v1.5.7](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.7) — 2026-02-07

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.6...v1.5.7)

* `🔧 update(types+docs):` update type def for `Timestamp` to allow maximum compatibility across libraries
* `📦 deps:` updated deps

## [v1.5.6](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.6) — 2026-02-05

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.4...v1.5.6)

* `📚 docs:` updated tsdoc and README.md
* `📚 docs:` updated README.md and CONTRIBUTING.md

## [v1.5.4](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.4) — 2026-02-05

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.3...v1.5.4)

* `📦 deps:` moved nhb-toolbox in dev deps

## [v1.5.3](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.3) — 2026-02-05

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.2...v1.5.3)

* `📦 deps:` moved nhb-toolbox to main deps

## [v1.5.2](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.2) — 2026-02-05

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.1...v1.5.2)

* `🐛 fix(types):` made `currentValue` param of `onUpdate` method 'not optional'

## [v1.5.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.1) — 2026-02-05

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.5.0...v1.5.1)

* `📚 docs:` updated README.md
* `🔧 update(types):` updated type defs with strict interfaces

## [v1.5.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.5.0) — 2026-02-04

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.4.0...v1.5.0)

* `🧼 refactor(src/query.ts):` organized query builders to optimize results
* `📚 docs:` updated README.md and tsdoc for types
* `🧼 refactor(types):` updated some type defs
* `🧼 refactor(where):` merged `whereByIndex` with existing `where` method as overloads in delete and update queries
* `✨ feat:` added new methods and updated `uuidV4` logic
* `🔧 update(docs):` added demo project live link in the docs
* `🧹 cleanup(demo):` removed locality-idb package, using the live codes
* `🔧 update(demo):` replaced `locality` with actual `locality-idb` package
* `🐛 fix(demo):` fixed issues in demo/pnpm-lock.yaml file
* `🐛 fix(demo):` fixed dependency issue in the demo project
* `🔧 update(demo):` updated demo project

## [v1.4.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.4.0) — 2026-02-04

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.3.1...v1.4.0)

* `🧱 build:` removed support for UMD

## [v1.3.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.3.1) — 2026-02-04

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.3.0...v1.3.1)

* `🐛 fix:` fixed issues with the new getter methods
* `✨ feat(Locality):` added new methods and tested more in the demo project

## [v1.3.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.3.0) — 2026-02-04

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.2.1...v1.3.0)

* `🔧 update(docs):` updated README.md and fixed some type defs
* `🐛 fix:` fixed some minor issues and refactored some codeblocks
* `🐛 fix(transaction):` fully fixed transaction issues
* `🐛 fix(transaction):` fixed maximum issues in transaction API
* `🧹 cleanup(types):` organized type definitions
* `🧼 refactor(transaction):` updated `transaction()` to align with the existing query APIs
* `🛠️ chore(client):` removed unnecessary lines
* `🔧 update(types):` updated type definitions for `transaction()` and `export()` methods
* `✨ feat(core+client):` added new transaction and export methods; fixed type issues and improved codebase
* `🔧 update:` updated README.md and fixed other dev issues
* `✨ feat(core):` added new `onUpdate()` method to auto update certain column(s) and updated docs
* `✨ feat(column):` added 2 new column types with type guards and built-in validation
* `🐛 fix(core/column):` `auto()` method is now available for instance created with `pk()`

## [v1.2.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.2.1) — 2026-02-01

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.2.0...v1.2.1)

* `📚 docs:` updated README.md

## [v1.2.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.2.0) — 2026-02-01

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.1.1...v1.2.0)

* `✨ feat(types/columns):` added feature to provide extended types for columns and updated README.md
* `✨ feat(validator):` added feature to provide custom validator for individual column
* `🐛 fix(validator):` fixed `validateAndPrepareData` to handle validation logic for optional and default values according to schema
* `📚 docs:` updated README.md and CONTRIBUTING.md; fixed some spelling issues
* `📚 docs(API+usage):` modified README.md to update docs for query with indexes and pk
* `🐛 fix(query):` fixed critical issue in transaction+store creation and optimized codebase

## [v1.1.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.1.1) — 2026-02-01

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.1.0...v1.1.1)

* `📚 docs:` updated docs in README.md
* `🐛 fix(type inference):` fixed type inference in `where` method and added new `exists()` method on SELECT query

## [v1.1.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.1.0) — 2026-02-01

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.0.1...v1.1.0)

* `✨ feat(query/SELECT):` added new `count` method, rename `first()`->`findFirst()` and optimized codebase

## [v1.0.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.0.1) — 2026-02-01

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v1.0.0...v1.0.1)

* `🐛 fix(promises):` fixed some issues in rejected promise(s)
* `🔧 update:` updated README.md intro
* `📚 docs:` updated README.md and CONTRIBUTING.md

## [v1.0.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v1.0.0) — 2026-02-01

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.7.1...v1.0.0)

* `🔧 update(query/SELECT):` updated method names to maintain consistency
* `🧹 cleanup:` removed unnecessary file(s)

## [v0.7.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.7.1) — 2026-01-31

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.7.0...v0.7.1)

* `🔧 update(validation):` added validation for pk and updated the docs
* `🐛 fix(select):` fixed issues regarding SELECT queries and updated docs
* `✨ feat(SELECT):` added new methods to get data by index or pk
* `📦 deps(dev):` updated dev deps

## [v0.7.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.7.0) — 2026-01-30

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.6.1...v0.7.0)

* `🔧 update:` updated docs, error handling and optimized syntax across the codebase
* `🐛 fix(errors):` handled transaction errors efficiently
* `✨ feat(index):` implemented indexing and uniqueness, updated type defs and docs
* `✨ feat(seed):` added method to seed data to particular table (store)
* `🔧 update(docs):` updated docs in README.md and inline tsdoc
* `🐛 fix(utils):` fixed issues with `isTimestamp`
* `✨ feat(delete):` added methods and utility to delete a db or store
* `⚡ perf(utils):` updated `validateColumnType`

## [v0.6.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.6.1) — 2026-01-29

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.6.0...v0.6.1)

* `🔧 update:` added alias for `bool` column type `boolean` and updated docs

## [v0.6.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.6.0) — 2026-01-29

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.5.2...v0.6.0)

* `✨ feat(validation):` added column type validation for predefined types
* `🔧 update(types):` updated type defs and linter config
* `🔧 update(types):` updated type defs and docs

## [v0.5.2](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.5.2) — 2026-01-28

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.5.1...v0.5.2)

* `💅 style(docs):` updated README.md
* `📚 docs:` updated README.md

## [v0.5.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.5.1) — 2026-01-28

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.5.0...v0.5.1)

* `🔧 update(docs+utils):` updated `getTimestamp`, docs and added LICENSE file
* `📦 deps(readme):` updated README.md with full documentation

## [v0.5.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.5.0) — 2026-01-28

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.4.0...v0.5.0)

* `🔧 update(docs+types):` added tsdoc and updated type defs
* `🧼 refactor:` split code and redefined types
* `🔧 update(types):` updated type defs

## [v0.4.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.4.0) — 2026-01-27

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.3.3...v0.4.0)

* `✨ feat(queries):` updated type interface, methods and overall dx
* `🔧 update(tsconfig):` updated tsconfig.json
* `🧭 merge(demo):` merged demo practice project to test the package

## [v0.3.3](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.3.3) — 2026-01-26

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.3.1...v0.3.3)

* `🔧 update:` removed `Column` and `Table` classes from export
* 0.3.2

## [v0.3.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.3.1) — 2026-01-26

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.3.0...v0.3.1)

* `🔖 release(0.3.1):` bumped version to 0.3.1

## [v0.3.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.3.0) — 2026-01-26

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.2.0...v0.3.0)

* `✨ feat:` updated `defineSchema` and revised type system to enhance intellisense
* `🔧 update(types/columns):` updated some types and added more column types

## [v0.2.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.2.0) — 2026-01-25

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.1.2...v0.2.0)

* `🐛 fix(types):` resolved type related issues
* `🐛 fix(lint):` fixed linting issues

## [v0.1.2](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.1.2) — 2026-01-25

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.1.1...v0.1.2)

* `🔧 update(exports):` re-exported all the required utils

## [v0.1.1](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.1.1) — 2026-01-25

[Compare changes](https://github.com/nazmul-nhb/locality-idb/compare/v0.1.0...v0.1.1)

* `📦 deps(tsdown):` added new option to remove warning
* `🐛 fix(tsdown):` moved toolbox to dev deps
* `🧱 build(tsdown):` reconfigured tsdown to bundle external package(s)

## [v0.1.0](https://github.com/nazmul-nhb/locality-idb/releases/tag/v0.1.0) — 2026-01-25

* `✨ feat(locality):` implemented core logic of `Locality`
