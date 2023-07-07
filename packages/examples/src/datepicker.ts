import * as wecco from "@weccoframework/core"

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

export const datePicker = wecco.define<DatePickerData>("date-picker", ({ data, requestUpdate, emit }) => {
    let date: Date | null = null

    if (typeof data.value === "string" && data.value !== "") {
        date = new Date(data.value)
    } else if (data.value instanceof Date) {
        date = data.value
    }


    data.formatter = data.formatter ?? ((d: Date) => d.toLocaleDateString())
    data.message = data.message ?? "-"

    if (!data.inEdit) {
        const startEditing = () => {
            data.inEdit = true
            requestUpdate()
        }

        return wecco.html`<a href="#" class="text-sm bg-gray-400 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-full" 
            @click=${startEditing}>${date ? data.formatter.call(null, date) : data.message}</a>`
    }

    const onChange = (e: Event) => {
        data.inEdit = false
        data.value = (e.target as HTMLInputElement).valueAsDate ?? null
        emit("date-selected", data.value)
        requestUpdate()
    }

    return wecco.html`<input type="date" autofocus @change=${onChange} @blur=${onChange} .valueAsDate+omitempty=${date} style="display: inline-block;">`
}, { observedAttributes: ["value", "message"] })