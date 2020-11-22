import * as wecco from "@wecco/core"

/**
 * Defines the structure of data to be passed to a date picker instance.
 */
export interface DatePickerData {
    /** The value for the picker */
    value?: Date | string | null

    /** Start in editing mode? */
    inEdit?: boolean

    /** Formatter used to format a date for display. Defaults to `Date.toDateString()` */
    formatter?: (d: Date) => string

    /** Message to be issued when no date is selected. */
    message?: string
}

export const DatePicker = wecco.define("date-picker", (data: DatePickerData, context: wecco.RenderContext) => {
    let date: Date | null
    
    if (!data.value) {
        date = null
    } else {
        if (typeof data.value === "string") {
            date = new Date(data.value)
        } else {
            date = data.value
        }   
    }
    data.formatter = data.formatter || ((d: Date) => d.toDateString())
    data.message = data.message || "No date selected"

    if (!data.inEdit) {
        const selectDate = (e: Event) => {
            data.inEdit = true
            context.requestUpdate()
        }

        return wecco.html`<a href="#" @click=${selectDate}>${date ? data.formatter.call(null, date) : data.message}</a>`
    }

    const onChange = (e: Event) => {
        Promise.resolve()
            .then(() => {
                data.inEdit = false
                const value = (<HTMLInputElement>e.target).value
                if (value) {
                    const date = new Date(value)
                    data.value = date.toISOString().substr(0, 10)
                    context.emit("date-selected", date)
                } else {
                    data.value = null
                }
                return Promise.resolve()
            })

            .then(context.requestUpdate.bind(context))
    }

    let inputValue = ""
    if (date) {
        inputValue = date.toISOString().substr(0, 10)
    }

    return wecco.html`<input type="date" autofocus @change=${onChange} @blur=${onChange} value=${inputValue} style="display: inline-block;">`
}, "value", "message")