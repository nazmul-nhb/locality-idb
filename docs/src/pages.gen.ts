// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages } from 'waku/router'

// prettier-ignore
type Page =
	| { path: '/changelog'; render: 'static' }
	| { path: '/concepts/columns'; render: 'static' }
	| { path: '/concepts/inference'; render: 'static' }
	| { path: '/concepts/schema'; render: 'static' }
	| { path: '/faq'; render: 'static' }
	| { path: '/future-plans'; render: 'static' }
	| { path: '/guide/delete'; render: 'static' }
	| { path: '/guide/import-export'; render: 'static' }
	| { path: '/guide'; render: 'static' }
	| { path: '/guide/insert'; render: 'static' }
	| { path: '/guide/maintenance'; render: 'static' }
	| { path: '/guide/pagination-streaming'; render: 'static' }
	| { path: '/guide/query'; render: 'static' }
	| { path: '/guide/transactions'; render: 'static' }
	| { path: '/guide/update'; render: 'static' }
	| { path: '/'; render: 'static' }
	| { path: '/intro/features'; render: 'static' }
	| { path: '/intro'; render: 'static' }
	| { path: '/intro/motivation'; render: 'static' }
	| { path: '/reference'; render: 'static' }
	| { path: '/reference/modifiers'; render: 'static' }
	| { path: '/reference/queries'; render: 'static' }
	| { path: '/reference/schema-fns'; render: 'static' }
	| { path: '/reference/utilities'; render: 'static' }
	| { path: '/reference/validation'; render: 'static' }
	| { path: '/typescript/types'; render: 'static' };

// prettier-ignore
declare module 'waku/router' {
	interface RouteConfig {
		paths: PathsForPages<Page>;
	}
	interface CreatePagesConfig {
		pages: Page;
	}
}
