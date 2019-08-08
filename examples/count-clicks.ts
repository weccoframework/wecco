import * as wecco from "@wecco/core"

interface CountClicks {
    count: number
}

const CountClicks = wecco.define("count-clicks", (data: CountClicks, context) => {
    return wecco.html`<p>
        <button class="waves-effect waves-light btn" data-count=${data.count} @click=${() => { data.count++; context.requestUpdate(); }}>
            You clicked me ${data.count} times
        </button>
    </p>`
})

CountClicks({ count: 0 }).mount("#count-clicks-app")

