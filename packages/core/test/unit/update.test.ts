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

import { expect } from "iko"
import { html } from "../../src/html"
import { updateElement } from "../../src/update"

describe("update.ts", () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    describe("updateElement", () => {
        let el: Element

        beforeEach(function () {
            el = document.createElement("div")
        })

        it("w/ null", () => {
            updateElement(el, null)
            expect(el.childNodes.length).toBe(0)
            expect(el.textContent).toBe("")
        })

        it("w/ string", () => {
            updateElement(el, "hello, world")
            expect(el.childNodes.length).toBe(1)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        it("w/ element", () => {
            const span = document.createElement("span")
            span.textContent = "hello, world"
            updateElement(el, span)
            expect(el.childNodes.length).toBe(1)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        it("w/ element update function", () => {
            updateElement(el, (e: Element) => {
                const span = document.createElement("span")
                span.textContent = "hello, world"
                e.appendChild(span)
            })
            expect(el.childNodes.length).toBe(1)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        it("w/ element updater", () => {
            updateElement(el, html`<span>hello, world</span>`)
            expect(el.childNodes.length).toBe(1)
            expect(el.childNodes[0].textContent).toBe("hello, world")
        })

        it("w/ array", () => {
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

        it("w/ string should replace previous content", () => {
            const span = document.createElement("span")
            span.textContent = "remove me"
            el.appendChild(span)

            updateElement(el, "keep me")
            expect(el.innerHTML).toBe("keep me")
        })

        it("w/ element should replace previous content", () => {
            const span = document.createElement("span")
            span.textContent = "remove me"
            el.appendChild(span)

            const replacement = document.createElement("span")
            replacement.textContent = "keep me"

            updateElement(el, replacement)
            expect(el.innerHTML).toBe("<span>keep me</span>")
        })

        it("w/ array should replace previous content", () => {
            const span = document.createElement("span")
            span.textContent = "remove me"
            el.appendChild(span)

            updateElement(el, ["keep me", "and me"])
            expect(el.innerHTML).toBe("keep meand me")
        })

        it("twice with extended content 2nd time", () => {
            const target = document.createElement("div")

            updateElement(target, html`<div>1st</div>`)
            expect(target.innerHTML).toBe("<div>1st</div>")

            updateElement(target, html`<div>1st</div><div>2nd</div>`)
            expect(target.innerHTML).toBe("<div>1st</div><div>2nd</div>")
        })
    })
})