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

import { expect } from "iko"
import { app, AppContext, NoModelChange } from "../../src/app"
import { html } from "../../src/html"
import { ElementUpdate } from "../../src/update"
import { removeMarkerComments } from "./testutils"

describe("app.ts", () => {
    beforeEach(() => {
        document.body = document.createElement("body")
    })

    type Model = string
    type Message = string

    const view = (m: Model, ctx: AppContext<Model>): ElementUpdate => {
        return html`<p>${m}</p>`
    }

    describe("synchronous update", () => {
        const update = (m: Model, msg: Message, ctx: AppContext<Model>): Model => {
            return msg
        }
    
        it("should render initial model", () => {
            app(() => "hello, world", update, view, document.body)
    
            expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
        })
    
        it("should apply update", () => {
            const ctx = app(() => "hello, world", update, view, document.body)
            ctx.emit("hello, update")
    
            expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, update</p>")
        })
    
        it("should change nothing when update returns no model change sentinel value", () => {        
            const ctx = app(() => "hello, world", (m: Model, msg: Message, ctx: AppContext<Model>) => NoModelChange, view, document.body)
            ctx.emit("hello, update")
    
            expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
        })
    })

    describe("asynchronous update", () => {
        const update = (m: Model, msg: Message, ctx: AppContext<Model>): Promise<Model> => {
            return Promise.resolve(msg)
        }
    
        it("should render initial model", () => {
            app(() => Promise.resolve("hello, world"), update, view, document.body)

            return new Promise(resolve => {
                setTimeout(() => {
                    expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
                    resolve(null)
                }, 1)
            })        
        })
    
        it("should apply update", () => {
            const ctx = app(() => Promise.resolve("hello, world"), update, view, document.body)
            ctx.emit("hello, update")

            return new Promise(resolve => {
                setTimeout(() => {
                    expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, update</p>")
                    resolve(null)
                }, 1)
            })
        })
    
        it("should change nothing when update returns no model change sentinel value", () => {        
            const ctx = app(() => Promise.resolve("hello, world"), (m: Model, msg: Message, ctx: AppContext<Model>) => Promise.resolve(NoModelChange), view, document.body)
            ctx.emit("hello, update")

            return new Promise(resolve => {
                setTimeout(() => {
                    expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
                    resolve(null)
                }, 1)
            })
        })
    })
})