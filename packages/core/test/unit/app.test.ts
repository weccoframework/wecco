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
import { createApp, NoModelChange, UpdaterContext, ViewContext } from "../../src/app"
import { html } from "../../src/html"
import { ElementUpdate } from "../../src/update"
import { removeMarkerComments } from "./testutils"

describe("app.ts", () => {
    beforeEach(() => {
        document.body = document.createElement("body")
    })

    type Model = string
    type Message = string

    const view = ({ model }: ViewContext<Model, Message>): ElementUpdate => {
        return html`<p>${model}</p>`
    }

    describe("synchronous update", () => {
        const update = ({ message }: UpdaterContext<Model, Message>): Model => {
            return message
        }

        it("should render initial model", () => {
            createApp(() => "hello, world", update, view).mount(document.body)

            expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
        })

        it("should apply update", () => {
            const app = createApp(() => "hello, world", update, view).mount(document.body)
            app.emit("hello, update")

            expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, update</p>")
        })

        it("should change nothing when update returns no model change sentinel value", () => {
            const app = createApp(() => "hello, world", (_) => NoModelChange, view).mount(document.body)
            app.emit("hello, update")

            expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
        })
    })

    describe("asynchronous update", () => {
        const update = ({ message }: UpdaterContext<Model, Message>) => Promise.resolve(message)

        it("should render initial model", () => {
            createApp(() => Promise.resolve("hello, world"), update, view).mount(document.body)

            return new Promise(resolve => {
                setTimeout(() => {
                    expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
                    resolve(null)
                }, 1)
            })
        })

        it("should apply update", () => {
            const app = createApp(() => Promise.resolve("hello, world"), update, view).mount(document.body)
            app.emit("hello, update")

            return new Promise(resolve => {
                setTimeout(() => {
                    expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, update</p>")
                    resolve(null)
                }, 1)
            })
        })

        it("should change nothing when update returns no model change sentinel value", () => {
            const app = createApp(() => Promise.resolve("hello, world"), () => Promise.resolve(NoModelChange), view).mount(document.body)
            app.emit("hello, update")

            return new Promise(resolve => {
                setTimeout(() => {
                    expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello, world</p>")
                    resolve(null)
                }, 1)
            })
        })
    })

    describe("model initialization context", () => {
        const update = ({ message }: UpdaterContext<Model, Message>): Model => {
            return message
        }

        it("should emit messages from model init", () => {
            createApp(({emit}) => {
                emit("hello again")
                return "hello, world"
            }, update, view).mount(document.body)

            expect(removeMarkerComments(document.body.innerHTML)).toBe("<p>hello again</p>")
        })
    })
})