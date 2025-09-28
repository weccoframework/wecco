import * as wecco from "@weccoframework/core"

import "./datepicker"

// -- Models

class TodoList {
    constructor(public readonly title: string | null, public readonly items: ReadonlyArray<TodoItem>) { }

    addItem(item: TodoItem): TodoList {
        const items = this.items.slice()
        items.push(item)
        return new TodoList(this.title, items)
    }

    deleteItem(index: number): TodoList {
        const items = this.items.slice()
        items.splice(index, 1)
        return new TodoList(this.title, items)
    }

    updateItem(index: number, ...updates: Array<FieldUpdate>): TodoList {
        const items = this.items.slice()
        items[index] = items[index].applyUpdates(...updates)

        return new TodoList(this.title, items)
    }
}

type FieldUpdate = [keyof TodoItem, unknown]

class TodoItem {
    constructor(public summary: string, public complete: boolean = false, public dueDate: Date | null = null, public editing: boolean = false) { }

    applyUpdates(...updates: Array<FieldUpdate>): TodoItem {
        const item = new TodoItem(this.summary, this.complete, this.dueDate, this.editing)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updates.forEach(u => (item as any)[u[0]] = u[1])
        return item
    }
}

// -- Messages

interface Add {
    command: "add",
}

interface Update {
    command: "update",
    index: number,
    field: keyof TodoItem,
    value: unknown
}

interface Delete {
    command: "delete",
    index: number,
}

type Message = Add | Update | Delete

// -- Persistence

interface PersistentTodoItem {
    summary: string
    complete: boolean
    dueDate: string | null
}

class Store {
    constructor(private key: string = "todos") { }

    load(): TodoList {
        const jsonData = window.localStorage.getItem(this.key)

        if (!jsonData) {
            return new TodoList(null, [])
        }

        try {
            const data = JSON.parse(jsonData)
            return new TodoList(data.title, data.items.map((i: PersistentTodoItem) => new TodoItem(i.summary, i.complete, i.dueDate ? new Date(i.dueDate) : null)))
        } catch {
            window.localStorage.setItem(this.key, "")
            return new TodoList(null, [])
        }
    }

    save(list: TodoList) {
        const data = {
            title: list.title,
            items: list.items.map(i => {
                return {
                    summary: i.summary,
                    complete: i.complete,
                    dueDate: i.dueDate?.toISOString() ?? null,
                }
            }),
        }

        const jsonData = JSON.stringify(data)
        window.localStorage.setItem(this.key, jsonData)
    }
}

// -- View

function view({ emit, model }: wecco.ViewContext<TodoList, Message>): wecco.ElementUpdate {
    return wecco.html`
        <div class="flex flex-row justify-between mb-2">
            <h2 class="font-bold text-lg">${model.title || "Todos"}</h2>

            <button 
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full"
                @click=${() => emit({ command: "add" })}>
                <i class="material-icons">add</i>
            </button>
        </div>
        
        <div>
            ${model.items.map(itemView.bind(null, emit))}
        </div>
    `
}

function itemView(emit: wecco.MessageEmitter<Message>, model: TodoItem, idx: number,): wecco.ElementUpdate {
    const onChange = (e: InputEvent) => emit({
        command: "update",
        index: idx,
        field: "summary",
        value: (e.target as HTMLInputElement).value,
    })

    const markAsComplete = () => emit({
        command: "update",
        index: idx,
        field: "complete",
        value: true,
    })

    const remove = () => emit({
        command: "delete",
        index: idx,
    })

    let main

    if (model.editing) {
        main = wecco.html`<input 
            type="text" 
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring ring-blue-600"
            @change=${onChange} autofocus placeholder="Summary" autofocus>`
    } else if (model.complete) {
        main = wecco.html`
            <div class="font-bold line-through mb-4">${model.summary}</div>
            <a @click=${remove} class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full"><i class="material-icons">delete</i></a>            
        `
    } else {
        main = wecco.html`
            <div class="font-bold mb-4">${model.summary}</div>
            <div class="gap">
                <a @click=${markAsComplete} class="text-sm bg-gray-400 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full"><i class="material-icons">check</i></a>
                
                <date-picker value=${model.dueDate?.toISOString()} @date-selected=${(e: CustomEvent) => emit({ command: "update", index: idx, field: "dueDate", value: e.detail })}><span class="material-icons">calendar</span></date-picker>
                <a @click=${remove} class="text-sm bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full"><i class="material-icons">delete</i></a>
            </div>
        `
    }

    return wecco.html`<div class="border rounded p-2 mb-2 shadow">${main}</div>`
}

// Controller

const store = new Store("@weccoframework/examples/todos")

function update({ model, message }: wecco.UpdaterContext<TodoList, Message>): TodoList {
    switch (message.command) {
        case "add":
            model = model.addItem(new TodoItem("", false, null, true))
            break

        case "update":
            model = model.updateItem(message.index, [message.field, message.value], ["editing", false])
            break

        case "delete":
            model = model.deleteItem(message.index)
    }

    store.save(model)

    return model
}

document.addEventListener("DOMContentLoaded", () => {
    wecco.createApp(() => store.load(), update, view).mount("#todo-app")
})
