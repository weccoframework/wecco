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

/**
 * A function that can initialize a model.
 * This type is generic on the produced model's type.
 */
export type ModelInitializer<MODEL> = () => MODEL | Promise<MODEL>

/**
 * A function that updates a model based on messages passed to it.
 * The function may produce a new model or modify the given model in place.
 * This type is generic on the model's and message's type.
 */
export type Updater<MODEL, MESSAGE> = (model: MODEL, message: MESSAGE, context: AppContext<MESSAGE>) => ModelResult<MODEL>

/**
 * Interface for a context object which can be used to control an app by sending messages.
 * The interface is generic on the type of message.
 */
export interface AppContext<M> {
    emit(message: M): void
}

/**
 * A function that takes a model and an app context and produces a ViewResult.
 * The type is generic on both the model's and message's type.
 * @param model the model to render a view for
 * @param context the context used to emit messages
 * @return the result of the rendering process
 */
export type View<MODEL, MESSAGE> = (model: MODEL, context: AppContext<MESSAGE>) => ElementUpdate

/**
 * Creates a new app using the given components.
 * @param modelInitializer initializer to create the initial model - either synchronously or asynchronously
 * @param updater applies update messages to the model - either synchronously or asynchronously
 * @param view renders the model - always synchronously
 * @param mountPoint the mount point to control using this app
 * @returns an AppContext that can be used to control the app by emitting messages
 */
export function app<MODEL, MESSAGE>(modelInitializer: ModelInitializer<MODEL>, updater: Updater<MODEL, MESSAGE>, view: View<MODEL, MESSAGE>, mountPoint: ElementSelector): AppContext<MESSAGE> {
    return new AppContextImpl(modelInitializer, updater, view, resolve(mountPoint))
}

class AppContextImpl<MODEL, MESSAGE> implements AppContext<MESSAGE> {
    private model: MODEL

    constructor(modelInitializer: ModelInitializer<MODEL>, private readonly updater: Updater<MODEL, MESSAGE>, private readonly view: View<MODEL, MESSAGE>, private readonly mountPoint: Element) {
        const m = modelInitializer()
        if (m instanceof Promise) {
            m
                .then(model => {
                    this.model = model
                    this.performUpdate()
                })
                .catch(console.error)
            return
        }

        this.model = m
        this.performUpdate()
    }

    emit(message: MESSAGE) {
        const result = this.updater(this.model, message, this)
        if (result instanceof Promise) {
            result
                .then(this.applyModel.bind(this))
                .catch(console.error)
            return
        }

        this.applyModel(result)
    }

    private applyModel(model: MODEL | typeof NoModelChange) {
        if (model == NoModelChange) {
            return
        }

        this.model = model as MODEL
        this.performUpdate()
    }

    private performUpdate() {
        updateElement(this.mountPoint, this.view(this.model, this))
    }
}