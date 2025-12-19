/*
 * This file is part of wecco.
 *
 * Copyright (c) 2019 - 2025 The wecco authors.
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
            await page.evaluate(() => wecco.define("test-component", ({data}) => wecco.html`<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
            await expect(page.locator("#app p")).toHaveText("hello, world")
        })

        test("should render interactive element", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => wecco
                .define("test-component",
                ({data, requestUpdate}) => wecco.html`<button @click=${() => { data.c++; requestUpdate() }}>${data.c}</button>`)({ c: 0 }).mount("#app"))

            const btn = page.locator("#app button")
            await expect(btn).toHaveText("0")
            
            await btn.click()
            await expect(btn).toHaveText("1")
        })

        test("should rerender component when setData is called", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                const c = wecco.define("test-component", ({data}) => wecco.html`<p>${data.c} ${data.m}</p>`)
                const e = c({ c: 0, m: "times" })
                e.mount("#app")
                e.setData({ c: 1 })
            })

            await expect(page.locator("#app p")).toHaveText("1 times")
        })

        test("should bind html attribute values to data properties", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data}) => wecco.html`<p>${data.text}</p>`, { observedAttributes: ["text"] })
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })

            await expect(page.locator("#app p")).toHaveText("foo bar")
        })

        test("should bind data property changes to html attribute values", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data, requestUpdate}) => {
                    if (data.text !== "changed") {
                        setTimeout(() => {
                            data.text = "changed"
                            requestUpdate()
                        }, 1)
                    }
                    return wecco.html`<p>${data.text}</p>`
                }, { observedAttributes: ["text"] })
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })

            await expect(page.locator("#app test-component")).toHaveAttribute("text", "changed")
        })

        test("should bind data property changes to html attribute values and stringify values", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data, requestUpdate}) => {
                    if (data.text !== "changed") {
                        setTimeout(() => {
                            data.text = null
                            requestUpdate()
                        }, 1)
                    }
                    return wecco.html`<p>${data.text}</p>`
                }, { observedAttributes: ["text"] })
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })

            await expect(page.locator("#app test-component")).toHaveAttribute("text", "")
        })

        test("should emit custom events", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window._receivedEvent = null
                document.addEventListener("test", e => {
                    window._receivedEvent = e.detail
                })
                wecco.define("test-component", ({data, emit, requestUpdate}) => {
                    if (!data.send) {
                        setTimeout(() => {
                            data.send = true
                            emit("test", "foobar")
                            requestUpdate()
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

        test("should emit connect/disconnect events", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window._connectReceived = false
                window._disconnectReceived = false

                document.addEventListener("connect", e => {
                    window._connectReceived = true
                })

                wecco.define("test-component", ({addEventListener}) => {
                    addEventListener("disconnect", e => {
                        window._disconnectReceived = true
                    })
    
                    return "test"
                })

                document.querySelector("#app").innerHTML = "<test-component></test-component>"
                setTimeout(() => document.querySelector("#app").innerHTML = "", 5)
            })

            await sleep(40)
            const [connectReceived, disconnectReceived] = await page.evaluate(() => [window._connectReceived, window._disconnectReceived])
            expect(connectReceived).toBe(true)
            expect(disconnectReceived).toBe(true)
        })

        test("should emit and subscribe for custom events", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("my-button", ({data, emit}) => {
                    return wecco.html`<button @click+preventDefault+stopPropagation=${() => emit("click")}>${data.label}</button>`
                }, { observedAttributes: ["label"] })

                wecco.define("count-clicks", (context) => {
                    context.data.count = context.data.count || 0
                    context.addEventListener("click", () => {
                        context.data.count++
                        context.requestUpdate()
                    })

                    return wecco.html`
                    <p>You clicked me ${context.data.count} times.</p>
                    <my-button label="Increment counter" />
                `
                })

                document.querySelector("#app").innerHTML = "<count-clicks/>"
            })

            await page.locator("#app count-clicks my-button button").click()
            await expect(page.locator("#app count-clicks p")).toHaveText("You clicked me 1 times.")
        })

        test("should invoke @updateend eventlistener after component has been updated (html syntax)", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("my-component", () => wecco.html`<span @updateend=${e => e.target.innerText = "foo"}>bar</span>`)
                document.querySelector("#app").innerHTML = "<my-component></my-component>"
            })

            await expect(page.locator("#app span")).toHaveText("foo")
        })

        test("should invoke @updateend eventlistener after component has been updated (js api)", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.mountCalled = 0
                const c = wecco.define("my-component", ({data}) => wecco.html`<span @updateend=${() => window.mountCalled++}>${data.message}</span>`)
                const e = c({ message: "hello" })
                e.mount("#app")
                e.setData({ message: "world" })
            })
            await sleep()

            expect(await page.evaluate(() => window.mountCalled)).toBe(2)
        })

        test("should invoke @updateend eventlistener after nested component has been updated", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("my-component", () => wecco.html`<div><span @updateend=${e => e.target.innerText = "foo"}>bar</span></div>`)
                document.querySelector("#app").innerHTML = "<my-component></my-component>"
            })
            await sleep()

            await expect(page.locator("#app div span")).toHaveText("foo")
        })

        test("should invoke @updateend for a custom element only once per update cycle", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.updateCounter = 0;
                const comp = wecco.define("test-component", () => {
                    const onUpdate = () => {
                        window.updateCounter++
                    }
                    return wecco.html`<h1 @updateend=${onUpdate}>test-component</h1>`
                })

                wecco.updateElement("#app", comp())
            })
            await sleep()

            const count = await page.evaluate(() => window.updateCounter)
            expect(count).toBe(1)
        })

        test("should invoke @updateend for a custom element wrapped in html tagged string only once per mounting cycle", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                window.mountCounter = 0;
                const comp = wecco.define("test-component", () => {
                    const onMount = () => {
                        window.mountCounter++
                    }
                    return wecco.html`<h1 @updateend=${onMount}>test-component</h1>`
                })

                wecco.updateElement(document.querySelector("#app"), wecco.html`<div>${comp()}</div>`)
            })
            await sleep()

            const count = await page.evaluate(() => window.mountCounter)
            expect(count).toBe(1)
        })

        test("should render double-nested html tags from custom element", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                const expandToAdd = wecco.define("test-expand-to-add", ({data, requestUpdate}) => {
                    const toggleState = () => {
                        data.isExpanded = !data.isExpanded
                        requestUpdate()
                    }

                    if (!data.isExpanded) {
                        return wecco.html`<a href="#" @click+preventDefault=${toggleState}>${data.collapsed}</a>`
                    }

                    return wecco.html`${data.collapsed}<div class="expand-overlay">${data.expanded}</div>`
                })

                const test = "test"

                wecco.updateElement(document.querySelector("#app"), wecco.html`<div>${expandToAdd({
                    collapsed: wecco.html`<div class="foo ${test}">${test}</div>`,
                    expanded: wecco.html`<div class="bar">expanded</div>`,
                })}</div>`)
            })
            await sleep()

            await page.locator("#app div a").click()

            const innerHTML = await page.locator("#app").innerHTML()            
            expect(innerHTML).toBe("<div><!----><test-expand-to-add><!----><div class=\"foo test\"><!---->test<!----></div><!----><div class=\"expand-overlay\"><!----><div class=\"bar\">expanded</div><!----></div></test-expand-to-add><!----></div>")
        })
    })

    test.describe("attributes", () => {
        test("should bind html attribute values to data properties", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data}) => wecco.html`<p>${data.text}</p>`, { observedAttributes: ["text"] })
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })
            
            await expect(page.locator("#app p")).toHaveText("foo bar")
        })

        test("should bind multiple html attribute values when array is given", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data}) => wecco.html`<p>${data.a1}${data.a2}</p>`, { observedAttributes: ["a1", "a2"] })
                document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
            })
            
            await expect(page.locator("#app p")).toHaveText("foobar")
        })

        test("should bind multiple html attribute values when multiple names are given", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data}) => wecco.html`<p>${data.a1}${data.a2}</p>`, { observedAttributes: ["a1", "a2"] })
                document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
            })
            
            await expect(page.locator("#app p")).toHaveText("foobar")
        })

        test("should bind data property changes to html attribute values", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data, requestUpdate}) => {
                    if (data.text !== "changed") {
                        setTimeout(() => {
                            data.text = "changed"
                            requestUpdate()
                        }, 1)
                    }
                    return wecco.html`<p>${data.text}</p>`
                }, { observedAttributes: ["text"]})
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })

            await expect(page.locator("#app test-component")).toHaveAttribute("text", "changed")
        })
    })

    test.describe("properties", () => {
        test("should render observed property", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data}) => {
                    return wecco.html`<p>${data.label}</p>`
                }, { observedProperties: ["label"]})
                
                window.testComponentInstance = wecco.component("test-component")
                window.testComponentInstance.label = "foo"
                window.testComponentInstance.mount("#app")
            })
          
            await expect(page.locator("#app p")).toHaveText("foo")
        })

        test("should re-render observed property on change", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data}) => {
                    return wecco.html`<p>${data.label}</p>`
                }, { observedProperties: ["label"]})
                
                window.testComponentInstance = wecco.component("test-component", {label: "foo"})
                window.testComponentInstance.mount("#app")

                setTimeout(() => { window.testComponentInstance.label = "bar" }, 2)
            })
          
            await expect(page.locator("#app p")).toHaveText("bar")
        })

        test("should reflect changed data field via observed property", async ({page}) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("test-component", ({data, requestUpdate}) => {
                    setTimeout(() => {
                        data.label = "bar"
                        requestUpdate()
                    }, 5)
                    return wecco.html`<p>${data.label}</p>`
                }, { observedProperties: ["label"]})
                
                window.testComponentInstance = wecco.component("test-component", {label: "foo"})
                window.testComponentInstance.mount("#app")
            })
          
            await expect(page.locator("#app p")).toHaveText("bar")
            expect(await page.evaluate(() => window.testComponentInstance.label)).toBe("bar")
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
                    return wecco.html`<div @updateend=${init}></div>`
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
                    return wecco.shadow(wecco.html`<div @updateend=${init}></div>`)
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
                        wecco.html`<div @updateend=${init}></div>`
                    ])
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            await sleep(10)

            const eventTargets = await page.evaluate(() => window._receivedEventTargets)
            expect(eventTargets.length).toBe(1)
        })

        test("should invoke @updateend for custom elements", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                wecco.define("custom-element", () => "")
                window.updateCalled = 0
                wecco.updateElement("#app", wecco.html`<custom-element @updateend=${() => { window.updateCalled++ }}></custom-element>`)
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
                wecco.define("test-component", ({data, emit, requestUpdate}) => {
                    if (!data.send) {
                        setTimeout(() => {
                            data.send = true
                            emit("test", "foobar")
                            requestUpdate()
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
                wecco.define("my-button", ({data, emit}) => {
                    return wecco.html`<button @click+stopPropagation+preventDefault=${() => emit("click")}>${data.label}</button>`
                }, { observedAttributes: ["label"] })

                wecco.define("count-clicks", ({data, requestUpdate, addEventListener}) => {
                    data.count = data.count || 0
                    addEventListener("click", () => {
                        data.count++
                        requestUpdate()
                    })

                    return wecco.html`
                    <p>You clicked me ${data.count} times.</p>
                    <my-button label="Increment counter" />
                `
                })

                document.querySelector("#app").innerHTML = "<count-clicks/>"
            })

            await page.locator("#app count-clicks my-button button").click()
            await expect(page.locator("#app count-clicks p")).toHaveText("You clicked me 1 times.")
        })

        test("should emit and subscribe for custom events on same component", async ({ page }) => {
            await page.goto(".")
            await page.evaluate(() => {
                const b = wecco.define("my-button", ({data, emit}) => {
                    return wecco.html`<button @click=${() => emit("click")}>${data.label}</button>`
                }, { observedAttributes: ["label"] })

                document.querySelector("#app").innerHTML = "<my-button label=\"test\"></my-button>"
            })

            await page.evaluate(() => {
                document.querySelector("my-button").addEventListener("click", () => {
                    document.querySelector("#app").innerHTML = "clicked"
                })
            })

            await page.locator("button").click()
            await expect(page.locator("#app")).toHaveText("clicked")
        })

        // TODO: Improve/Move this test
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
                wecco.define("test-component", ({data, requestUpdate, once}) => {
                    once("initializer", () => {
                        window.onceCallbackInvoked++
                    })

                    data.count = data.count || 0

                    if (data.count < 10) {
                        setTimeout(() => {
                            data.count += 1
                            requestUpdate()
                        }, 1)
                    }

                    return `count: ${data.count}; onceCallbackInvoked: ${window.onceCallbackInvoked}`
                })
                document.querySelector("#app").innerHTML = "<test-component></test-component>"
            })

            await expect(page.locator("#app")).toHaveText("count: 10; onceCallbackInvoked: 1")
        })
    })
})