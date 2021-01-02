/*
 * This file is part of wecco.
 *
 * Copyright (c) 2019 - 2020 The wecco authors.
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

import { expect } from "iko"
import { resolve, removeAllChildren, updateElement } from "../../src/dom"
import { html } from "../../src/html"

describe("dom.ts", async () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    describe("resolve", () => {
        it("should return element when element is given", () => {
            const el = document.createElement("div")
            expect(resolve(el)).toBe(el)
        })

        it("should return first match when given a string", () => {
            const el = document.createElement("div")
            document.body.appendChild(el)
            expect(resolve("div")).toBe(el)
        })

        it("should return nested match when given a string and a parent", () => {
            const el = document.createElement("div")
            document.body.appendChild(el)
            const child = document.createElement("div")
            el.appendChild(child)

            expect(resolve("div", el)).toBe(child)
        })
    })

    describe("removeAllChildren", () => {
        it("should do nothing with empty element", () => {
            const el = document.createElement("div")

            removeAllChildren(el)
        })

        it("should remove children", () => {
            const el = document.createElement("div")
            el.appendChild(document.createElement("div"))
            el.appendChild(document.createElement("div"))
            el.appendChild(document.createElement("div"))

            removeAllChildren(el)
            expect(el.childNodes.length).toBe(0)
        })
    })

    describe("updateElement", () => {
        let el: Element
        beforeEach(() => {
            el = document.createElement("div")
        })

        describe("w/ string", () => {
            updateElement(el, "<span>hello, world</span>")
            expect(el.childNodes.length).toBe(0)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        describe("w/ element", () => {
            const span = document.createElement("span")
            span.textContent = "hello, world"
            updateElement(el, span)
            expect(el.childNodes.length).toBe(0)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        describe("w/ element update function", () => {
            updateElement(el, (e: Element) => {
                const span = document.createElement("span")
                span.textContent = "hello, world"
                e.appendChild(span)
            })
            expect(el.childNodes.length).toBe(0)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        describe("w/ element updater", () => {
            updateElement(el, html`<span>hello, world</span>`)
            expect(el.childNodes.length).toBe(0)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        describe("w/ array", () => {
            const span = document.createElement("span")
            span.textContent = "hello, world #3"

            it("should apply all updates", () => {
                updateElement(el, [
                    "<span>hello, world #1</span>",
                    html`<span>hello, world #2</span>`,
                    span,
                ])
                expect(el.childNodes.length).toBe(3)
                expect(el.childNodes[0].textContent).toBe("hello, world #1")
                expect(el.childNodes[1].textContent).toBe("hello, world #2")
                expect(el.childNodes[3].textContent).toBe("hello, world #3")
            })
        })
    })
})