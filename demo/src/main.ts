import './style.css';

import './test';

import { isValidArray } from 'nhb-toolbox';
import { Chronos } from 'nhb-toolbox/chronos';
import { uuid } from 'nhb-toolbox/hash';
import { timeZonePlugin } from 'nhb-toolbox/plugins/timeZonePlugin';
import { Stylog } from 'nhb-toolbox/stylog';

import type { InferInsertType, InferSelectType, InferUpdateType, Timestamp } from 'locality';
import { column, defineSchema, deleteDB, getTimestamp, Locality, uuidV4 } from 'locality';
import { runAllTests } from './transaction-export';

Chronos.register(timeZonePlugin);

let todos: Partial<Todo>[] = [];

const todoInput = document.getElementById('todoInput') as HTMLInputElement;
const addBtn = document.getElementById('addBtn') as HTMLButtonElement;
const todoList = document.getElementById('todoList') as HTMLUListElement;
const clearCompletedBtn = document.getElementById('clearCompleted') as HTMLButtonElement;
const statsCompleted = document.getElementById('statsCompleted') as HTMLSpanElement;
const statsTotal = document.getElementById('statsTotal') as HTMLSpanElement;

const schema = defineSchema({
	todos: {
		serial: column.int().pk().auto(),
		task: column
			.text()
			// .validate((val) => {
			// 	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : 'Invalid email format';
			// })
			.unique()
			.onUpdate((old) => (old?.startsWith('pello ') ? 'pello' : (old ?? 'No Task'))),
		completed: column.bool().default(false),
		uuid: column.uuid().default(uuid({ version: 'v6' })),
		timestamp: column.timestamp().optional(),
		// .default(new Chronos().toLocalISOString() as Timestamp)
		createdAt: column.timestamp().default(new Chronos().toLocalISOString() as Timestamp),
		updatedAt: column.timestamp().onUpdate(() => getTimestamp()),
		url: column.url().optional(),
	},
	experiments: {
		id: column.float().pk().auto(),
		name: column.text().index(),
		active: column
			.bool()
			.default(true)
			.validate((v) => (v ? null : 'Active must be true')),
		email: column.email().optional(),
		url: column.url().optional(),
	},
});

type SchemaType = typeof schema;

type Todo = InferSelectType<SchemaType['todos']>;
type InsertTodo = InferInsertType<SchemaType['todos']>;
type UpdateTodo = InferUpdateType<SchemaType['todos']>;

// type _I = IndexKeyType<SchemaType['todos']>;
// type _P = PrimaryKeyType<SchemaType['todos']>;
// type _U = UniqueKeyType<SchemaType['todos']>;

const db = new Locality({
	dbName: 'todo-db',
	version: 37,
	schema,
});

// Load todos from IndexedDB
const loadTodos = async () => {
	todos = await db
		.from('todos')
		.select({ serial: true, task: true, completed: true, createdAt: true, updatedAt: true })
		.sortByIndex('serial', 'desc')
		.findAll();
	// as Todo[];

	console.table(todos);

	renderTodos();
	updateStats();
};

// Render todos to the DOM
const renderTodos = () => {
	todoList.innerHTML = '';

	if (todos.length === 0) {
		todoList.innerHTML = /*html*/ `
      <li class="text-center text-gray-400 py-8">No todos yet! Add one to get started!</li>
    `;
		return;
	}

	todos.forEach((todo) => {
		const li = document.createElement('li');
		li.className = `flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group`;

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = todo?.completed ?? false;
		checkbox.className = 'w-5 h-5 cursor-pointer accent-blue-600';
		checkbox.addEventListener('change', () =>
			toggleTodo(todo.serial!, {
				completed: !todo.completed,
				// updatedAt: new Chronos().toLocalISOString() as Timestamp,
			})
		);

		const span = document.createElement('span');
		span.textContent = `${todo.task} at ${todo.createdAt}`;
		span.className = `flex-1 text-gray-800 ${
			todo.completed ? 'line-through text-green-600' : ''
		}`;

		const deleteBtn = document.createElement('button');
		deleteBtn.textContent = 'Delete';
		deleteBtn.className = `px-3 py-1 text-sm font-semibold bg-red-500 text-white rounded cursor-pointer hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100`;

		deleteBtn.addEventListener('click', () => removeTodo(todo.serial!));

		li.appendChild(checkbox);
		li.appendChild(span);
		li.appendChild(deleteBtn);
		todoList.appendChild(li);
	});
};

// Add a new todo
const handleAddTodo = async () => {
	const task = todoInput.value.trim();

	if (!task) {
		alert('Please enter a task!');
		return;
	}

	const newTodo: InsertTodo = {
		task,
	};

	// await addTodo(newTodo);

	try {
		const inserted = await db.insert('todos').values(newTodo).run();

		console.dir(inserted);
	} catch (error) {
		if (error instanceof Error) {
			alert(error.message);
		}

		console.error(error);
	}

	todoInput.value = '';
	await loadTodos();
};

// Toggle todo completion status
const toggleTodo = async (id: number, update: UpdateTodo) => {
	// const updatedTodo = { completed: !update.completed };
	// await updateTodo(updatedTodo);
	try {
		await db
			.update('todos')
			.set(update)
			.where((t) => t.serial === id)
			.run();
	} catch (error) {
		if (error instanceof Error) {
			alert(error.message);
		}

		console.error(error);
	}

	await loadTodos();
};

// Remove a todo
const removeTodo = async (id: number) => {
	// await deleteTodo(id);
	await db
		.delete('todos')
		.where((t) => t.serial === id)
		.run();
	await loadTodos();
};

// Clear all completed todos
const handleClearCompleted = async () => {
	const completedTodos = todos.filter((t) => t.completed);
	for (const todo of completedTodos) {
		// await deleteTodo(todo.id!);
		await db
			.delete('todos')
			.where((t) => t.serial === todo.serial!)
			.run();
	}
	await loadTodos();
};

// Update stats
const updateStats = () => {
	const completed = todos.filter((t) => t.completed).length;
	statsCompleted.textContent = completed.toString();
	statsTotal.textContent = todos.length.toString();
};

// Event listeners
addBtn.addEventListener('click', handleAddTodo);
todoInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') handleAddTodo();
});

clearCompletedBtn.addEventListener('click', handleClearCompleted);

const clearStoreBtn = document.getElementById('clearStoreBtn') as HTMLButtonElement;
const clearDBBtn = document.getElementById('clearDBBtn') as HTMLButtonElement;
const clearThisDBBtn = document.getElementById('clearThisDBBtn') as HTMLButtonElement;
const exportDBBtn = document.getElementById('exportDBBtn') as HTMLButtonElement;

const dbNameSelect = document.getElementById('dbNameSelect') as HTMLSelectElement;
const tableNameSelect = document.getElementById('tableNameSelect') as HTMLSelectElement;
const storeNameSelect = document.getElementById('storeNameSelect') as HTMLSelectElement;

const prettyPrintInput = document.getElementById('prettyPrint') as HTMLInputElement;
const includeMetaInput = document.getElementById('includeMeta') as HTMLInputElement;

const populateExportTables = async () => {
	await db.ready();

	const existing = new Set([...tableNameSelect.options].map((opt) => opt.value.trim()));

	for (const tableName of db.tableList) {
		if (existing.has(tableName)) continue;

		const option = document.createElement('option');

		option.value = tableName;
		option.textContent = tableName;

		tableNameSelect.appendChild(option);
	}
};

exportDBBtn.addEventListener('click', async () => {
	const selected = tableNameSelect.value;
	const tables = selected === '__all__' ? undefined : [selected as keyof SchemaType];

	await db.export({
		tables,
		pretty: prettyPrintInput.checked,
		includeMetadata: includeMetaInput.checked,
	});
});

// Initialize on page load
window.addEventListener('load', async () => {
	const dbNames = await db.dbList;

	for (const { name, version } of dbNames) {
		const option = document.createElement('option');

		option.value = `${name}`;
		option.textContent = `${name} (v${version})`;

		dbNameSelect.appendChild(option);
	}

	await populateExportTables();

	clearDBBtn.addEventListener('click', async () => {
		const dbName = dbNameSelect.value;

		if (!dbName) {
			alert('Please select a database name!');
			return;
		}

		await deleteDB(dbName);

		location.reload();
	});

	clearThisDBBtn.addEventListener('click', async () => {
		await db.deleteDB();

		location.reload();
	});

	for (const storeName of db.tableList) {
		const option = document.createElement('option');

		option.value = storeName;
		option.textContent = storeName;

		storeNameSelect.appendChild(option);
	}

	clearStoreBtn.addEventListener('click', async () => {
		const storeName = storeNameSelect.value;

		if (!storeName) {
			alert('Please select a store name!');
			return;
		}

		await db.clearTable(storeName as keyof SchemaType);

		await loadTodos();
	});

	await loadTodos();

	const experiments = await db.from('experiments').findAll();

	if (!isValidArray(experiments)) {
		await db.seed('experiments', [
			{ name: 'Aeto', email: 'nazmul@yahoo.com' },
			{ name: 'Beto', url: 'https://example.com' },
			{ name: 'Ceto' },
			{ name: 'Deto' },
			{ name: 'Eeto' },
			{ name: 'Feto' },
			{ name: 'Geto' },
			{ name: 'Heto' },
			{ name: 'Ieto' },
			{ name: 'Jeto' },
			{ name: 'Keto' },
			{ name: 'Leto' },
			{ name: 'Meto' },
			{ name: 'Neto' },
			{ name: 'Oeto' },
			{ name: 'Peto' },
			{ name: 'Qeto' },
			{ name: 'Reto' },
			{ name: 'Seto' },
			{ name: 'Teto' },
			{ name: 'Ueto' },
			{ name: 'Veto' },
			{ name: 'Weto' },
			{ name: 'Xeto' },
			{ name: 'Yeto' },
			{ name: 'Zeto' },
		]);
	}

	// console.table(experiments);

	const ex1 = await db
		.from('experiments')
		.select({ id: true, name: true })
		// .select({ id: true })
		.findAll();

	const ex2 = await db
		.from('experiments')
		// .where((a) => a.name === 'Beto')
		.select({ id: true, name: true })
		.where('id', IDBKeyRange.bound(20, 29))
		// .sortByIndex('id', 'asc')
		.findAll();

	const ex3 = await db
		.from('experiments')
		.select({ id: true, name: true })
		.findByIndex('name', IDBKeyRange.bound('A', 'B'));

	console.info({ ex1, ex2, ex3 });
	// await db.deleteTable('experiments');

	const testWithToDo = await db.from('todos').where('task', 'hello').exists();

	console.info(testWithToDo);

	console.info(await db.dbList);
	console.info(await Locality.getDatabaseList());

	const page1 = await db
		.from('experiments')
		.select({ id: true, name: true })
		.sortByIndex('id')
		.page({ limit: 7 });

	const page2 = await db
		.from('experiments')
		.select({ id: true, name: true })
		.sortByIndex('id')
		.page({
			limit: 5,
			cursor: page1.nextCursor,
		});

	console.info({ page1, page2 });
	console.info(uuidV4());

	// Add test button event listener
	const runTestsBtn = document.getElementById('runTestsBtn') as HTMLButtonElement;
	runTestsBtn.addEventListener('click', async () => {
		Stylog.green.bold.log('🚀 Starting feature tests...');
		await runAllTests();
	});
});
