import * as wecco from "@weccoframework/core"

interface CountClicks {
    count?: number
}

const CountClicks = wecco.define("count-clicks", (data: CountClicks, context) => {
    if (typeof(data.count) === "undefined") {
        data.count = 0
    }

    return wecco.html`<p>
        <button 
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" 
            @click=${() => { data.count++; context.requestUpdate(); }}>
            You clicked me ${data.count} times
        </button>
    </p>`
}, "count")
