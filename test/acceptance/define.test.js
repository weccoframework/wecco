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

const { expect } = require("iko")
const { fixture: fixture } = require("./fixture.test")
const { sleep } = require("./sleep")

describe("define", () => {
    describe("render", () => {        
        it("should render static element", async () => {
            await fixture.page.evaluate(() => wecco.define("test-component", (data) => wecco.html`<p>${data.m}</p>`)({ m: "hello, world" }).mount("#app"))
            await sleep()
    
            const text = await fixture.page.$eval("#app p", e => e.innerText)
            expect(text).toBe("hello, world")
        })
        
        it("should render interactive element", () => {
            return fixture.page.evaluate(() => wecco
                .define("test-component",
                    (data, context) => wecco.html`<button @click=${() => { data.c++; context.requestUpdate() }}>${data.c}</button>`)({ c: 0 }).mount("#app"))
                .then(() => fixture.page.$eval("#app button", e => e.innerText))
                .then(text => expect(text).toBe("0"))
                .then(() => fixture.page.$("#app button"))
                .then(b => b.click())
                .then(() => new Promise(resolve => setTimeout(resolve, 5)))
                .then(() => fixture.page.$eval("#app button", e => e.innerText))
                .then(text => expect(text).toBe("1"))
        })
    
        it("should rerender component when setData is called", async () => {
            await fixture.page.evaluate(() => {
                const c = wecco.define("test-component", data => wecco.html`<p>${data.c} ${data.m}</p>`)
                const e = c({ c: 0, m: "times" })
                e.mount("#app")
                e.setData({ c: 1 })
            })
            await sleep()
    
            const text = await fixture.page.$eval("#app p", e => e.innerText)
            expect(text).toBe("1 times")
        })
    
        it("should bind html attribute values to data properties", async () => {
            await fixture.page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })
            await sleep()
    
            const text = await fixture.page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foo bar")
        })
    
        it("should bind data property changes to html attribute values", () => {
            return fixture.page.evaluate(() => {
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
                .then(() => new Promise(resolve => setTimeout(resolve, 10)))
                .then(() => fixture.page.$eval("#app test-component", e => e.getAttribute("text")))
                .then(text => expect(text).toBe("changed"))
        })
    
        it("should emit custom events", () => {
            return fixture.page.evaluate(() => {
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
                .then(() => new Promise(resolve => setTimeout(resolve, 10)))
                .then(() => fixture.page.evaluate(() => window._receivedEvent))
                .then(detail => expect(detail).toBe("foobar"))
        })
    
        it("should emit and subscribe for custom events", async () => {
            await fixture.page.evaluate(() => {
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
    
            await fixture.page.evaluate(() => {
                document.querySelector("button").dispatchEvent(new MouseEvent("click"))
            })
            await sleep()
    
            const text = await fixture.page.$eval("#app count-clicks p", e => e.innerText)
            expect(text).toBe("You clicked me 1 times.")
        })
    
        it("should invoke @mount eventlistener after component has been mounted", async () => {
            await fixture.page.evaluate(() => {
                wecco.define("my-component", () => wecco.html`<span @mount=${self => self.innerText = "foo"}>bar</span>`)
                document.querySelector("#app").innerHTML = "<my-component></my-component>"
            })
            await sleep()
    
            const text = await fixture.page.$eval("#app span", e => e.innerText)
            expect(text).toBe("foo")
        })
    
        it("should invoke @mount eventlistener after component has been updated", async () => {
            await fixture.page.evaluate(() => {
                window.mountCalled = 0
                const c = wecco.define("my-component", (data) => wecco.html`<span @mount=${() => window.mountCalled++}>${data.message}</span>`)
                const e = c({ message: "hello" })
                e.mount("#app")
                e.setData({ message: "world" })
            })
            await sleep()
    
            expect(await fixture.page.evaluate(() => window.mountCalled)).toBe(2)
        })
    
        it("should invoke @mount eventlistener after nested component has been mounted", async () => {
            await fixture.page.evaluate(() => {
                wecco.define("my-component", () => wecco.html`<div><span @mount=${self => self.innerText = "foo"}>bar</span></div>`)
                document.querySelector("#app").innerHTML = "<my-component></my-component>"
            })
            await sleep()
    
            const text = await fixture.page.$eval("#app div span", e => e.innerText)
            expect(text).toBe("foo")
        })
       
        it("should invoke @mount for a custom element only once per mounting cycle", async () => {
            await fixture.page.evaluate(() => {
                window.mountCounter = 0;
                const comp = wecco.define("test-component", () => {
                    const onMount = () => {
                        window.mountCounter++
                    }
                    return wecco.html`<h1 @mount=${onMount}>test-component</h1>`
                })
    
                wecco.updateElement(document.querySelector("#app"), comp())
            })
            await sleep()
    
            const count = await fixture.page.evaluate(() => window.mountCounter)
            expect(count).toBe(1)
        })
    
        it("should invoke @mount for a custom element wrapped in html tagged string only once per mounting cycle", async () => {
            await fixture.page.evaluate(() => {
                window.mountCounter = 0;
                const comp = wecco.define("test-component", () => {
                    const onMount = () => {
                        window.mountCounter++
                    }
                    return wecco.html`<h1 @mount=${onMount}>test-component</h1>`
                })
    
                wecco.updateElement(document.querySelector("#app"), wecco.html`<div>${comp()}</div>`)
            })
            await sleep()
    
            const count = await fixture.page.evaluate(() => window.mountCounter)
            expect(count).toBe(1)
        })
    })

    describe("attributes", () => {
        it("should bind html attribute values to data properties", async () => {
            await fixture.page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.text}</p>`, "text")
                document.querySelector("#app").innerHTML = "<test-component text='foo bar'></test-component>"
            })
            const text = await fixture.page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foo bar")
        })

        it("should bind multiple html attribute values when array is given", async () => {
            await fixture.page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.a1}${data.a2}</p>`, ["a1", "a2"])
                document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
            })
            const text = await fixture.page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foobar")
        })

        it("should bind multiple html attribute values when multiple names are given", async () => {
            await fixture.page.evaluate(() => {
                wecco.define("test-component", data => wecco.html`<p>${data.a1}${data.a2}</p>`, "a1", "a2")
                document.querySelector("#app").innerHTML = "<test-component a1='foo' a2='bar'></test-component>"
            })
            const text = await fixture.page.$eval("#app p", e => e.innerText)
            expect(text).toBe("foobar")
        })

        it("should bind data property changes to html attribute values", async () => {
            await fixture.page.evaluate(() => {
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
                text = await fixture.page.$eval("#app test-component", e => e.getAttribute("text"))
                if (text === "changed") {
                    break
                }
            }

            expect(text).toBe("changed")
        })
    })

    describe("events", () => {
        it("should emit custom events", () => {
            return fixture.page.evaluate(() => {
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
                .then(() => new Promise(resolve => setTimeout(resolve, 10)))
                .then(() => fixture.page.evaluate(() => window._receivedEvent))
                .then(detail => expect(detail).toBe("foobar"))
        })
    
        it("should emit and subscribe for custom events", () => {
            return fixture.page.evaluate(() => {
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
                    <my-button label="Increment counter"/>
                `
                })
    
                document.querySelector("#app").innerHTML = "<count-clicks/>"
            })
                .then(() => fixture.page.evaluate(() => {
                    document.querySelector("button").dispatchEvent(new MouseEvent("click"))
                }))
                .then(() => new Promise(resolve => setTimeout(resolve, 20)))
                .then(() => fixture.page.$eval("#app count-clicks p", e => e.innerText))
                .then(text => expect(text).toBe("You clicked me 1 times."))
        })
    
        it("should emit and subscribe for custom events on same component", () => {
            return fixture.page.evaluate(() => {
                const b = wecco.define("my-button", (data, context) => {
                    return wecco.html`<button @click=${() => context.emit("click")}>${data.label}</button>`
                }, "label")
    
                document.querySelector("#app").innerHTML = "<my-button label=\"test\"></my-button>"
            })
                .then(() => fixture.page.evaluate(() => {
                    document.querySelector("my-button").addEventListener("click", () => {
                        document.querySelector("#app").innerHTML = "clicked"
                    })
                }))
                .then(() => fixture.page.evaluate(() => {
                    document.querySelector("button").dispatchEvent(new MouseEvent("click"))
                }))
                .then(() => new Promise(resolve => setTimeout(resolve, 20)))
                .then(() => fixture.page.$eval("#app", e => e.innerText))
                .then(text => expect(text).toBe("clicked"))
        })
        
        it("should handle multiple elements with the same listener correct", async () => {
            await fixture.page.evaluate(() => {
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
            await fixture.page.evaluate(() => {
                document.querySelector("#app a:nth-of-type(1)").dispatchEvent(new MouseEvent("click"))
                document.querySelector("#app a:nth-of-type(2)").dispatchEvent(new MouseEvent("click"))
                document.querySelector("#app a:nth-of-type(2)").dispatchEvent(new MouseEvent("click"))
            })
            await sleep(10)
    
            const stats = await fixture.page.evaluate(() => window.clickStats)
    
            expect(stats.one).toBe(1)
            expect(stats.two).toBe(2)
        })
    })    

    describe("context", () => {
        it("should execute callback given to context.once just once", async () => {
            await fixture.page.evaluate(() => {
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
                text = await fixture.page.$eval("#app", e => e.innerText)
                if (text.startsWith("count: 10")) {
                    break
                }
            }
    
            expect(text).toBe("count: 10; onceCallbackInvoked: 1")
        })
    })    
})