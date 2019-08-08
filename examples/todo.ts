import * as wecco from "@wecco/core"

/**
 * Defines the structure of data to be passed to a date picker instance.
 */
export interface DatePickerData {
    /** The value for the picker */
    value?: Date

    /** Callback handler to receive change events */
    onChange?: (d: Date) => void

    /** Start in editing mode? */
    inEdit?: boolean

    /** Formatter used to format a date for display. Defaults to `Date.toDateString()` */
    formatter?: (d: Date) => string

    /** Message to be issued when no date is selected. */
    noDateSelectedMessage?: string
}

const DatePicker = wecco.define("wecco-data-picker", (data: DatePickerData, context: wecco.RenderContext) => {
    data.formatter = data.formatter || ((d: Date) => d.toDateString())
    data.noDateSelectedMessage = data.noDateSelectedMessage || "No date selected"

    if (!data.inEdit) {
        const selectDate = (e: Event) => {
            data.inEdit = true
            context.requestUpdate()
        }

        return wecco.html`<a href="#" @click=${selectDate}>${data.value !== null ? data.formatter.call(null, data.value) : data.noDateSelectedMessage}</a>`
    }

    const onChange = (e: Event) => {
        Promise.resolve()
            .then(() => {
                data.inEdit = false
                const value = (<HTMLInputElement>e.target).value
                if (value) {
                    const date = new Date(value)
                    data.value = date
                    if (data.onChange) {
                        data.onChange(data.value)
                    }
                } else {
                    data.value = null
                }
                return Promise.resolve()
            })

            .then(context.requestUpdate.bind(context))
    }

    let inputValue = ""
    if (data.value) {
        inputValue = data.value.toISOString().substr(0, 10)
    }

    return wecco.html`<input type="date" autofocus @change=${onChange} @blur=${onChange} value=${inputValue}>`
})

// -- Models

class TodoItem {
    constructor(public summary: string, public done: boolean = false, public dueDate: Date | null = null) { }
}

interface TodoItemData {
    item: TodoItem
    editable?: boolean
}

interface TodoData {
    title?: string
    items: TodoItemData[]
}

// -- Event names

enum TodoEvents {
    Add = "add",
    Modified = "mod",
    Deleted = "del",
}

// -- Persistence

class TodoItemStore {
    constructor(private key: string = "todos") { }

    load(): TodoItem[] {
        const jsonData = window.localStorage.getItem(this.key)

        if (!jsonData) {
            return []
        }

        try {
            const data = JSON.parse(jsonData)
            return data.map((d: any) => new TodoItem(d.s, d.d, d.u ? new Date(d.u) : null))
        } catch (e) {
            window.localStorage.setItem(this.key, "")
            return []
        }
    }

    save(items: TodoItem[]) {
        const data = items.map(i => {
            return {
                s: i.summary,
                d: i.done,
                u: i.dueDate ? i.dueDate.toISOString() : "",
            }
        })
        const jsonData = JSON.stringify(data)
        window.localStorage.setItem(this.key, jsonData)
    }
}

// -- Components

const TodoItemView = wecco.define("todo-item", (data: TodoItemData, context) => {
    const markAsDone = () => { data.item.done = true; context.emit(TodoEvents.Modified, data.item) }
    const remove = () => { context.emit(TodoEvents.Deleted, data.item) }
    const onChange = (e: Event) => {
        data.item.summary = (<HTMLInputElement>e.target).value
        context.emit(TodoEvents.Modified, data.item)
    }

    return wecco.html`
    <div class="card">
        <div class="card-content">
          ${data.editable ? wecco.html`<input type="text" @change=${onChange} autofocus placeholder="Summary">` : wecco.html`<p>${data.item.summary}</p>`}          
        </div>
        <div class="card-action">
            ${ data.item.done ? "" : wecco.html`<a @click=${markAsDone}><i class="material-icons">check_circle</i></a>`}
          ${DatePicker({
        value: data.item.dueDate,
        onChange: (d: Date) => {
            data.item.dueDate = d
            context.emit(TodoEvents.Modified, data.item)
        },
        noDateSelectedMessage: "Select due date"
    })}
            <a @click=${remove}><i class="material-icons">delete</i></a>
        </div>
    </div>`
})

const TodoItemListView = wecco.define("todo-list", (data: TodoData, context) => {
    return wecco.html`
        <h3>${data.title || "Todos"}</h3>
        <div>
        ${data.items.map(i => TodoItemView(i))}
        </div>
        <div class="mt-2 text-right">
            <button class="waves-effect waves-light btn" @click=${() => context.emit(TodoEvents.Add)}><i class="material-icons">add</i></button>
        </div>
    `
})

// -- Controller (=== App)

class TodoApp implements wecco.Controller {
    private store: TodoItemStore
    private items: TodoItemData[]

    constructor() {
        this.store = new TodoItemStore("wecco.examples.todos")
        this.items = this.store.load().map(i => { return { item: i, editable: false } })
    }

    handleEvent(event: string, payload: any, render: wecco.ControllerRenderCallback) {
        switch (event) {
            case TodoEvents.Add:
                this.items.push({ item: new TodoItem(""), editable: true })
                break

            case TodoEvents.Modified:
                this.items.find(i => i.item === payload).editable = false
                break

            case TodoEvents.Deleted:
                const index = this.items.findIndex(i => i.item.summary === payload.summary)
                this.items.splice(index, 1)
                break
        }

        this.store.save(this.items.map(i => i.item))

        render(TodoItemListView({
            title: "My Todos",
            items: this.items,
        }))
    }
}

wecco.controller("#todo-app", new TodoApp())
