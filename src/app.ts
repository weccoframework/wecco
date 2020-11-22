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

import { updateElement, ElementUpdate, ElementSelector, resolve, removeAllChildren } from "./dom"

/**
 * A function that can initialize a model.
 * This type is generic on the produced model's type.
 */
export type ModelInitializer<M> = () => M

/**
 * A function that updates a model based on messages passed to it.
 * The function may produce a new model or modify the given model in place.
 * This type is generic on the model's and message's type.
 */
export type Updater<MODEL, MESSAGE> = (model: MODEL, message: MESSAGE) => MODEL

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

export function app<MODEL, MESSAGE>(modelInitialier: ModelInitializer<MODEL>, updater: Updater<MODEL, MESSAGE>, view: View<MODEL, MESSAGE>, mountPoint: ElementSelector): AppContext<MESSAGE> {
    return new AppContextImpl(modelInitialier(), updater, view, resolve(mountPoint))
}

class AppContextImpl<MODEL, MESSAGE> implements AppContext<MESSAGE> {
    constructor (private model: MODEL, private updater: Updater<MODEL, MESSAGE>, private view: View<MODEL, MESSAGE>, private mointPoint: Element) {
        updateElement(this.mointPoint, this.view(this.model, this))
    }

    emit(message: MESSAGE) {   
        this.model = this.updater(this.model, message)
        removeAllChildren(this.mointPoint)
        updateElement(this.mointPoint, this.view(this.model, this))
    }
}