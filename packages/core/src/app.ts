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

import { ElementSelector, resolve } from "./dom"
import { updateElement, ElementUpdate } from "./update"

/**
 * A sentinel value representing the updater's decision _not_ to update the model and skip the re-rendering cycle.
 */
export const NoModelChange = {}

/**
 * The return type for update functions.
 */
export type ModelResult<M> = M | typeof NoModelChange | Promise<M> | Promise<typeof NoModelChange>

export type MessageEmitter<MESSAGE> = (msg: MESSAGE) => void

export interface ViewContext<MODEL, MESSAGE> {
    emit: MessageEmitter<MESSAGE>
    get model(): MODEL
}

/**
 * A function that takes a model and an app context and produces a ViewResult.
 * The type is generic on both the model's and message's type.
 * @param ctx the app context to emit messages
 * @param model the model to render a view for
 * @returns the result of the rendering process
 */
export type View<MODEL, MESSAGE> = (ctx: ViewContext<MODEL, MESSAGE>) => ElementUpdate

/**
 * A function that can initialize a model.
 * This type is generic on the produced model's type.
 */
export type ModelInitializer<MODEL> = () => MODEL | Promise<MODEL>

export interface UpdaterContext<MODEL, MESSAGE> extends ViewContext<MODEL, MESSAGE> {
    get message(): MESSAGE
}

/**
 * A function that updates a model based on messages passed to it.
 * The function may produce a new model or modify the given model in place.
 * This type is generic on the model's and message's type.
 * @param ctx the app context
 * @param model the current model
 * @param message the message that caused this invocation of the updater
 * @returns the model result to render
 */
export type Updater<MODEL, MESSAGE> = (ctx: UpdaterContext<MODEL, MESSAGE>) => ModelResult<MODEL>

export interface App<MODEL, MESSAGE> {
    emit(msg: MESSAGE): App<MODEL, MESSAGE>
    mount(mountPoint: ElementSelector): App<MODEL, MESSAGE>
}

/**
 * Creates a new app using the given components.
 * @param modelInitializer initializer to create the initial model - either synchronously or asynchronously
 * @param updater applies update messages to the model - either synchronously or asynchronously
 * @param view renders the model - always synchronously
 * @param mountPoint the mount point to control using this app
 * @returns an App that can be used to control the app by emitting messages
 */
export function createApp<MODEL, MESSAGE>(modelInitializer: ModelInitializer<MODEL>, updater: Updater<MODEL, MESSAGE>, view: View<MODEL, MESSAGE>): App<MODEL, MESSAGE> {
    return new AppImpl(modelInitializer, updater, view)
}

class AppImpl<MODEL, MESSAGE> implements App<MODEL, MESSAGE> {
    private _model: MODEL | undefined
    private mountPoint: Element | undefined

    constructor(modelInitializer: ModelInitializer<MODEL>, private readonly updater: Updater<MODEL, MESSAGE>, private readonly view: View<MODEL, MESSAGE>) {
        const m = modelInitializer()
        if (m instanceof Promise) {
            m
                .then(model => {
                    this._model = model
                    this.performUpdate()
                })
                .catch(console.error)
            return
        }

        this._model = m
    }

    mount(mountPoint: ElementSelector) {
        this.mountPoint = resolve(mountPoint)
        this.performUpdate()
        return this
    }

    get model(): MODEL {
        return this._model
    }

    emit(message: MESSAGE) {
        const result = this.updater({
            emit: this.emit.bind(this),
            model: this._model,
            message
        })

        if (isPromise<MODEL>(result)) {
            result
                .then(m => this.applyModel(m))
                .catch(console.error)
            return
        }

        this.applyModel(result)
        return this
    }

    private applyModel(model: MODEL | typeof NoModelChange) {
        if (model == NoModelChange) {
            return
        }

        this._model = model as MODEL
        this.performUpdate()
    }

    private performUpdate() {
        if (typeof(this._model) === "undefined") {
            return
        }
        if (typeof(this.mountPoint) === "undefined") {
            return
        }
        updateElement(this.mountPoint, this.view({
            emit: this.emit.bind(this),
            model: this._model,
        }))
    }
}

function isPromise<MODEL>(m: ModelResult<MODEL>): m is Promise<MODEL> {
    return m instanceof Promise
}