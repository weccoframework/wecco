import * as wecco from "@weccoframework/core"

interface CountClicks {
    count?: number
}

const CountClicks = wecco.define("count-clicks", (data: CountClicks, context) => {
    if (typeof(data.count) === "undefined") {
        data.count = 0
    }

    return wecco.html`<p>
        <button class="btn btn-primary" @click=${() => { data.count++; context.requestUpdate(); }}>
            You clicked me ${data.count} times
        </button>
    </p>`
}, "count")
