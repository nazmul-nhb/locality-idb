import './style.css';

import './test';

import { isValidArray } from 'nhb-toolbox';
import { Chronos } from 'nhb-toolbox/chronos';
import { timeZonePlugin } from 'nhb-toolbox/plugins/timeZonePlugin';

import type { InferInsertType, InferSelectType, InferUpdateType, Timestamp } from 'locality';
import { column, defineSchema, deleteDB, Locality } from 'locality';

Chronos.register(timeZonePlugin);

let todos: Todo[] = [];

const todoInput = document.getElementById('todoInput') as HTMLInputElement;
const addBtn = document.getElementById('addBtn') as HTMLButtonElement;
const todoList = document.getElementById('todoList') as HTMLUListElement;
const clearCompletedBtn = document.getElementById('clearCompleted') as HTMLButtonElement;
const statsCompleted = document.getElementById('statsCompleted') as HTMLSpanElement;
const statsTotal = document.getElementById('statsTotal') as HTMLSpanElement;

const schema = defineSchema({
	todos: {
		serial: column.int().auto().pk(),
		task: column.text().unique(),
		completed: column.bool().default(false),
		uuid: column.uuid(),
		timestamp: column.timestamp().optional(),
		test: column.char(3).optional(),
		createdAt: column.timestamp().default(new Chronos().toLocalISOString() as Timestamp),
		// TODO: Add some method that will trigger only when updating
		updatedAt: column.timestamp().default(new Chronos().toLocalISOString() as Timestamp),
	},
	experiments: {
		id: column.uuid().pk(),
		name: column.text().index(),
		active: column.bool().default(true),
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
		// .select({ serial: true, timestamp: true })
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
		checkbox.checked = todo.completed;
		checkbox.className = 'w-5 h-5 cursor-pointer accent-blue-600';
		checkbox.addEventListener('change', () =>
			toggleTodo(todo.serial, {
				completed: !todo.completed,
				updatedAt: new Chronos().toLocalISOString() as Timestamp,
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

// Initialize on page load
window.addEventListener('load', async () => {
	clearDBBtn.addEventListener('click', async () => {
		const storeNameInput = document.getElementById('dbNameInput') as HTMLInputElement;

		const storeName = storeNameInput.value.trim();

		if (!storeName) {
			alert('Please enter a database name!');
			return;
		}

		await deleteDB(storeName);

		location.reload();
	});

	clearThisDBBtn.addEventListener('click', async () => {
		await db.deleteDB();

		location.reload();
	});

	clearStoreBtn.addEventListener('click', async () => {
		const storeNameInput = document.getElementById('storeNameInput') as HTMLInputElement;

		const storeName = storeNameInput.value.trim();

		if (!storeName) {
			alert('Please enter a store name!');
			return;
		}

		await db.clearTable(storeName as keyof SchemaType);

		await loadTodos();
	});

	await loadTodos();

	const experiments = await db.from('experiments').findAll();

	if (!isValidArray(experiments)) {
		await db.seed('experiments', [
			{ name: 'Ato', active: false },
			{ name: 'Beto' },
			{ name: 'Ceto' },
		]);
	}

	console.table(experiments);

	const ex1 = await db
		.from('experiments')
		.select({ name: true })
		// .select({ id: true })
		.findByPk('84864f8a-31e7-42b0-950d-de1d9de6d0a5');

	const ex2 = await db
		.from('experiments')
		// .where((a) => a.name === 'Beto')
		.select({ name: true })
		.where('id', IDBKeyRange.bound('c', 'f'))
		// .sortByIndex('id', 'asc')
		.findAll();

	const ex3 = await db
		.from('experiments')
		.select({ name: true })
		.findByIndex('name', IDBKeyRange.bound('A', 'B'));

	console.info({ ex1, ex2, ex3 });
	// await db.deleteTable('experiments');

	const testWithToDo = await db.from('todos').where('task', 'hello').exists();

	console.info(testWithToDo);
});
