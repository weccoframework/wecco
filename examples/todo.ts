import * as wecco from "@wecco/core"

// -- Models

class TodoList {
    constructor (public title: String | null, public items: TodoItem[]) {}
}

class TodoItem {
    constructor(public summary: string, public complete: boolean = false, public dueDate: Date | null = null, public editing: boolean = false) { }
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

const store = new Store("wecco.examples.todos")

function update(model: TodoList, message: Message): TodoList {
    switch (message.command) {
        case "add":
            model.items.push(new TodoItem("", false, null, true))
            break
        
        case "update": {
            const item = model.items[message.index]
            item.editing = false;
            (item as any)[message.field] = message.value            
            break
        }

        case "delete":
            model.items.splice(message.index, 1)
            break
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
