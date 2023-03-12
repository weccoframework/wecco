/*
 * This file is part of wecco.
 *
 * Copyright (c) 2019 - 2021 The wecco authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, test } from "@playwright/test"
import { sleep } from "./sleep"

test.describe("define", () => {
    test.describe("render", () => {
        test("should render static element", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => wecco.define("test-component", (data) => wecco.html`<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
            await sleep()

            const text = await page.$eval("#app p", e => e.innerText)
            expect(text).toBe("hello, world")
        })

        test("should render interactive element", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => wecco
                .define("test-component",
                    (data, context) => wecco.html`<button @click=${() => { data.c++; context.requestUpdate() }}>${data.c}</button>`)({ c: 0 }).mount("#app"))

            let text = await page.$eval("#app button", e => e.innerText)
            expect(text).toBe("0")

            const btn = await page.$("#app button")
            await btn.click()

            await sleep(5)

            text = await page.$eval("#app button", e => e.innerText)
            expect(text).toBe("1")
        })

        test("should rerender component when setData is called", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                const c = wecco.define("test-component", data => wecco.html`<p>${data.c} ${data.m}</p>`)
                const e = c({ c: 0, m: "times" })
                e.mount("#app")
                e.setData({ c: 1 })
            })

            await sleep()

            const text = await page.$eval("#app p", e => e.innerText)
            expect(text).toBe("1 times")
        })

        test("should bind html attribute values to data properties", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })

            await sleep()

            const text = await page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foo bar")
        })

        test("should bind data property changes to html attribute values", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", (data, context) => {
                    if (data.text !== "changed") {
                        setTimeout(() => {
                            data.text = "changed"
                            context.requestUpdate()
                        }, 1)
                    }
                    return wecco.html`<p>${data.text}</p>`
                }, "text")
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })

            await sleep(10)
            const text = await page.$eval("#app test-component", e => e.getAttribute("text"))
            expect(text).toBe("changed")
        })

        test("should emit custom events", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window._receivedEvent = null
                document.addEventListener("test", e => {
                    window._receivedEvent = e.detail
                })
                wecco.define("test-component", (data, context) => {
                    if (!data.send) {
                        setTimeout(() => {
                            data.send = true
                            context.emit("test", "foobar")
                            context.requestUpdate()
                        }, 1)
                    }
                    return "test"
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            await sleep(10)
            const detail = await page.evaluate(() => window._receivedEvent)
            expect(detail).toBe("foobar")
        })

        test("should emit and subscribe for custom events", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("my-button", (data, context) => {
                    return wecco.html`<button @click=${() => context.emit("click")}>${data.label}</button>`
                }, "label")

                wecco.define("count-clicks", (data, context) => {
                    data.count = data.count || 0
                    context.addEventListener("click", () => {
                        data.count++
                        context.requestUpdate()
                    })

                    return wecco.html`
                    <p>You clicked me ${data.count} times.</p>
                    <my-button label="Increment counter" />
                `
                })

                document.querySelector("#app").innerHTML = "<count-clicks/>"
            })

            await page.evaluate(() => {
                document.querySelector("button").dispatchEvent(new MouseEvent("click"))
            })
            await sleep()

            const text = await page.$eval("#app count-clicks p", e => e.innerText)
            expect(text).toBe("You clicked me 1 times.")
        })

        test("should invoke @update eventlistener after component has been updated (html syntax)", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("my-component", () => wecco.html`<span @update=${e => e.target.innerText = "foo"}>bar</span>`)
                document.querySelector("#app").innerHTML = "<my-component></my-component>"
            })
            await sleep()

            const text = await page.$eval("#app span", e => e.innerText)
            expect(text).toBe("foo")
        })

        test("should invoke @update eventlistener after component has been updated (js api)", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.mountCalled = 0
                const c = wecco.define("my-component", (data) => wecco.html`<span @update=${() => window.mountCalled++}>${data.message}</span>`)
                const e = c({ message: "hello" })
                e.mount("#app")
                e.setData({ message: "world" })
            })
            await sleep()

            expect(await page.evaluate(() => window.mountCalled)).toBe(2)
        })

        test("should invoke @update eventlistener after nested component has been updated", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("my-component", () => wecco.html`<div><span @update=${e => e.target.innerText = "foo"}>bar</span></div>`)
                document.querySelector("#app").innerHTML = "<my-component></my-component>"
            })
            await sleep()

            const text = await page.$eval("#app div span", e => e.innerText)
            expect(text).toBe("foo")
        })

        test("should invoke @update for a custom element only once per update cycle", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.updateCounter = 0;
                const comp = wecco.define("test-component", () => {
                    const onUpdate = () => {
                        window.updateCounter++
                    }
                    return wecco.html`<h1 @update=${onUpdate}>test-component</h1>`
                })

                wecco.updateElement("#app", comp())
            })
            await sleep()

            const count = await page.evaluate(() => window.updateCounter)
            expect(count).toBe(1)
        })

        test("should invoke @update for a custom element wrapped in html tagged string only once per mounting cycle", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.mountCounter = 0;
                const comp = wecco.define("test-component", () => {
                    const onMount = () => {
                        window.mountCounter++
                    }
                    return wecco.html`<h1 @update=${onMount}>test-component</h1>`
                })

                wecco.updateElement(document.querySelector("#app"), wecco.html`<div>${comp()}</div>`)
            })
            await sleep()

            const count = await page.evaluate(() => window.mountCounter)
            expect(count).toBe(1)
        })
    })

    test.describe("attributes", () => {
        test("should bind html attribute values to data properties", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })
            const text = await page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foo bar")
        })

        test("should bind multiple html attribute values when array is given", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.a1}${data.a2}</p>`, ["a1", "a2"])
                document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
            })
            const text = await page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foobar")
        })

        test("should bind multiple html attribute values when multiple names are given", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.a1}${data.a2}</p>`, "a1", "a2")
                document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
            })
            const text = await page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foobar")
        })

        test("should bind data property changes to html attribute values", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", (data, context) => {
                    if (data.text !== "changed") {
                        setTimeout(() => {
                            data.text = "changed"
                            context.requestUpdate()
                        }, 1)
                    }
                    return wecco.html`<p>${data.text}</p>`
                }, "text")
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })

            let text = ""
            while (true) {
                await sleep(10)
                text = await page.$eval("#app test-component", e => e.getAttribute("text"))
                if (text === "changed") {
                    break
                }
            }

            expect(text).toBe("changed")
        })
    })

    test.describe("events", () => {
        test("should emit update event", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window._receivedEventTarget = ""

                const init = e => {
                    window._receivedEventTarget = e.target.nodeName
                }

                wecco.define("test-component", () => {
                    return wecco.html`<div @update=${init}></div>`
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            await sleep(10)

            const eventTarget = await page.evaluate(() => window._receivedEventTarget)
            expect(eventTarget).toBe("DIV")
        })

        test("should emit update event in shadow root", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window._receivedEventTarget = ""

                const init = e => {
                    window._receivedEventTarget = e.target.nodeName
                }

                wecco.define("test-component", () => {
                    return wecco.shadow(wecco.html`<div @update=${init}></div>`)
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            await sleep(10)

            const eventTarget = await page.evaluate(() => window._receivedEventTarget)
            expect(eventTarget).toBe("DIV")
        })

        test("should emit update event in shadow root only once", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window._receivedEventTargets = []

                wecco.define("test-component", () => {
                    const init = e => {
                        window._receivedEventTargets.push(e.target.nodeName)
                    }
                    return wecco.shadow([
                        wecco.html`<div @update=${init}></div>`
                    ])
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            await sleep(10)

            const eventTargets = await page.evaluate(() => window._receivedEventTargets)
            expect(eventTargets.length).toBe(1)
        })

        test("should invoke @update for custom elements", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("custom-element", () => "")
                window.updateCalled = 0
                wecco.updateElement("#app", wecco.html`<custom-element @update=${() => { window.updateCalled++ }}></custom-element>`)
            })
            await sleep()

            const updateCalled = await page.evaluate(() => window.updateCalled)
            expect(updateCalled).toBe(1)
        })

        test("should emit custom events", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window._receivedEvent = null
                document.addEventListener("test", e => {
                    window._receivedEvent = e.detail
                })
                wecco.define("test-component", (data, context) => {
                    if (!data.send) {
                        setTimeout(() => {
                            data.send = true
                            context.emit("test", "foobar")
                            context.requestUpdate()
                        }, 1)
                    }
                    return "test"
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            await sleep(10)

            const detail = await page.evaluate(() => window._receivedEvent)
            expect(detail).toBe("foobar")
        })

        test("should emit and subscribe for custom events", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("my-button", (data, context) => {
                    return wecco.html`<button @click=${() => context.emit("click")}>${data.label}</button>`
                }, "label")

                wecco.define("count-clicks", (data, context) => {
                    data.count = data.count || 0
                    context.addEventListener("click", () => {
                        data.count++
                        context.requestUpdate()
                    })

                    return wecco.html`
                    <p>You clicked me ${data.count} times.</p>
                    <my-button label="Increment counter" />
                `
                })

                document.querySelector("#app").innerHTML = "<count-clicks/>"
            })

            await page.evaluate(() => {
                document.querySelector("button").dispatchEvent(new MouseEvent("click"))
            })

            await sleep(20)
            const text = await page.$eval("#app count-clicks p", e => e.innerText)
            expect(text).toBe("You clicked me 1 times.")
        })

        test("should emit and subscribe for custom events on same component", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                const b = wecco.define("my-button", (data, context) => {
                    return wecco.html`<button @click=${() => context.emit("click")}>${data.label}</button>`
                }, "label")

                document.querySelector("#app").innerHTML = "<my-button label=\"test\"></my-button>"
            })

            await page.evaluate(() => {
                document.querySelector("my-button").addEventListener("click", () => {
                    document.querySelector("#app").innerHTML = "clicked"
                })
            })

            await page.evaluate(() => {
                document.querySelector("button").dispatchEvent(new MouseEvent("click"))
            })
            await sleep(20)
            const text = await page.$eval("#app", e => e.innerText)
            expect(text).toBe("clicked")
        })

        test("should handle multiple elements with the same listener correct", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.clickStats = {
                    one: 0,
                    two: 0,
                }
                wecco.updateElement("#app", wecco.html`
                    <a @click=${() => window.clickStats.one++}>One</a>
                    <a @click=${() => window.clickStats.two++}>Two</a>
                `)
            })
            await sleep(10)
            await page.evaluate(() => {
                document.querySelector("#app a:nth-of-type(1)").dispatchEvent(new MouseEvent("click"))
                document.querySelector("#app a:nth-of-type(2)").dispatchEvent(new MouseEvent("click"))
                document.querySelector("#app a:nth-of-type(2)").dispatchEvent(new MouseEvent("click"))
            })
            await sleep(10)

            const stats = await page.evaluate(() => window.clickStats)

            expect(stats.one).toBe(1)
            expect(stats.two).toBe(2)
        })
    })

    test.describe("context", () => {
        test("should execute callback given to context.once just once", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.onceCallbackInvoked = 0
                wecco.define("test-component", (data, context) => {
                    context.once("initializer", () => {
                        window.onceCallbackInvoked++
                    })

                    data.count = data.count || 0

                    if (data.count < 10) {
                        setTimeout(() => {
                            data.count += 1
                            context.requestUpdate()
                        }, 1)
                    }

                    return `count: ${data.count}; onceCallbackInvoked: ${window.onceCallbackInvoked}`
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            let text = ""
            while (true) {
                await sleep(10)
                text = await page.$eval("#app", e => e.innerText)
                if (text.startsWith("count: 10")) {
                    break
                }
            }

            expect(text).toBe("count: 10; onceCallbackInvoked: 1")
        })
    })
})