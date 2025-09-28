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
import { shadow } from "../../src/shadow"
import { ElementUpdater } from "../../src/update";

describe("shadow.ts", async () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    describe("shadow", () => {
        it("should create shadow and append element", () => {
            const el = document.createElement("div")
            const child = document.createElement("div")

            shadow(child)(el)

            expect(el.shadowRoot.childNodes[0]).toBe(child)
        })

        it("should reuse existing shadow and append element", () => {
            const el = document.createElement("div")
            el.attachShadow({ mode: "open" })
            const child = document.createElement("div")

            shadow(child)(el)

            expect(el.shadowRoot.childNodes[0]).toBe(child)
        })

        it("should create shadow and invoke callback", () => {
            const el = document.createElement("div")
            const child = document.createElement("div")
            shadow((s: Element) => s.appendChild(child))(el)

            expect(el.shadowRoot.childNodes[0]).toBe(child)
        })

        it("should create shadow and apply content producer", () => {
            const el = document.createElement("div")
            const child = document.createElement("div")

            shadow(new (class implements ElementUpdater {
                updateElement(host: Element) {
                    host.appendChild(child)
                }
            }))(el)

            expect(el.shadowRoot.childNodes[0]).toBe(child)
        })
    })
})