import * as wecco from "@weccoframework/core"

class Model {
    constructor(public readonly count: number, public readonly explanation: string) {}

    inc() {
        return new Model(this.count + 1, this.explanation)
    }
}

type Message = "inc"

function update({model}: wecco.UpdaterContext<Model, Message>): Model {
    return model.inc()
}

function view ({ emit, model }: wecco.ViewContext<Model, Message>) {
    return wecco.html`
    <p class="text-sm">${model.explanation}</p>
    <p>
        <button 
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            @click=${() => emit("inc")}>
            You clicked me ${model.count} times
        </button>
    </p>`
}

document.addEventListener("DOMContentLoaded", () => {
    wecco.createApp(() => new Model(0, "Click the button to increment the counter."), update, view)
        .mount("#count-clicks-app")
})
