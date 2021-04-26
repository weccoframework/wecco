import * as wecco from "@weccoframework/core"

// -- Models

class TodoList {
    constructor (public readonly title: String | null, public readonly items: ReadonlyArray<TodoItem>) {}

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

type FieldUpdate = [keyof TodoItem, any]

class TodoItem {
    constructor(public summary: string, public complete: boolean = false, public dueDate: Date | null = null, public editing: boolean = false) { }

    applyUpdates(...updates: Array<FieldUpdate>): TodoItem {
        const item = new TodoItem(this.summary, this.complete, this.dueDate, this.editing)
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
    value: any
}

interface Delete {
    command: "delete",
    index: number,
}

type Message = Add | Update | Delete

// -- Persistence

class Store {
    constructor(private key: string = "todos") { }

    load(): TodoList {
        const jsonData = window.localStorage.getItem(this.key)

        if (!jsonData) {
            return new TodoList(null, [])
        }

        try {
            const data = JSON.parse(jsonData)
            return new TodoList(data.title, data.items.map((i: any) => new TodoItem(i.summary, i.complete, i.dueDate ? new Date(i.dueDate) : null)))
        } catch (e) {
            window.localStorage.setItem(this.key, "")
            return new TodoList(null, [])
        }
    }

    save(list: TodoList) {
        const data = {
            title: list.title,
            items: list.items.map(i => { return {
                summary: i.summary,
                complete: i.complete,
                dueDate: i.dueDate?.toISOString() ?? null,
            }}),
        }
                
        const jsonData = JSON.stringify(data)
        window.localStorage.setItem(this.key, jsonData)
    }
}

// -- View

function view(model: TodoList, context: wecco.AppContext<Message>): wecco.ElementUpdate {
    return wecco.html`
        <h2>${model.title || "Todos"}</h2>
        <div>
            ${model.items.map((item, idx) => item_view(item, idx, context))}
        </div>
        
        <div class="mt-2 text-right">
            <button class="btn btn-primary" @click=${() => context.emit({ command: "add" })}><i class="material-icons">add</i></button>
        </div>
    `
}

function item_view(model: TodoItem, idx: number, context: wecco.AppContext<Message>): wecco.ElementUpdate {
    const onChange = (e: InputEvent) => context.emit({
            command: "update", 
            index: idx,
            field: "summary",
            value: (e.target as HTMLInputElement).value,
        })

    const markAsComplete = () => context.emit({
        command: "update",
        index: idx,
        field: "complete",
        value: true,
    })

    const remove = () => context.emit({
        command: "delete",
        index: idx,
    })

    return wecco.html`
    <div class="card">
        <div class="card-body">
            ${model.editing 
                ? wecco.html`<input type="text" class="form-control" @change=${onChange} autofocus placeholder="Summary">` 
                : model.complete
                    ? wecco.html`<h5 class="card-title complete">${model.summary}</h5>`
                    : wecco.html`<h5 class="card-title">${model.summary}</h5>`
            }          
            ${model.complete ? "" : wecco.html`<a @click=${markAsComplete} class="btn btn-primary"><i class="material-icons">check_circle</i></a>`}
            <date-picker value=${model.dueDate?.toISOString()} @date-selected=${(e: CustomEvent) => { context.emit({
                command: "update",
                index: idx,
                field: "dueDate",
                value: e.detail,
            })}} message="Select due date"></date-picker>
            <a @click=${remove} class="btn btn-danger"><i class="material-icons">delete</i></a>
        </div>
    </div>`
}

// Controller

const store = new Store("wecco.examples.todos")

function update(model: TodoList, message: Message): TodoList {
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
    wecco.app(
        () => store.load(),
        update,
        view,
        "#todo-app",
    )
})
