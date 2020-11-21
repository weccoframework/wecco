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

import { ElementSelector, resolve, removeAllChildren } from "./dom"
import { WeccoCustomEventName, WeccoCustomEventDetails, WeccoElement } from "./element"

export type EmitEventCallback = (eventName: string, payload: any) => void

/**
 * Name of the event that is dispatched after the controller has been initialized.
 */
export const ControllerEventInit = "_init"

export type ControllerRenderCallback = (content: string | Node) => void

/** 
 * `ControllerEventHandler` defines the type of function to be passed to `wecco.controller`.
 * @param event the event to be handled
 * @param paylod the event's payload if any
 * @param render callback used to notify the framework on render updates
 * @param emit event emitter method used to dispatch another event
 */
export type ControllerEventHandler = (event: string, payload: any, render: ControllerRenderCallback, emit: EmitEventCallback) => void

/**
 * Interface for controller classes. Instead of passing a `ControllerEventHandler` directly to `controller`, you can pass an instance
 * of `Controller` to `controller` to get better state management.
 */
export interface Controller {
    /**
     * The event handler method. See `ControllerEventHandler`
     */
    handleEvent: ControllerEventHandler
}

/**
 * Type used for anything that can be used as a controller instance.
 */
export type ControllerInstance = ControllerEventHandler | Controller

export function controller(host: ElementSelector, handler: ControllerInstance) {
    new ControllerWrapper(resolve(host), handler)
}

class ControllerWrapper {
    constructor(private host: Element, private handler: ControllerInstance) {
        this.dispatchEvent(ControllerEventInit)
        this.host.addEventListener(WeccoCustomEventName, (e: CustomEvent) => {
            e.preventDefault()
            e.stopPropagation()
            const eventData: WeccoCustomEventDetails = e.detail
            this.dispatchEvent(eventData.name, eventData.payload)
        }, false)
    }

    emit = (event: string, payload: any): void => {
        this.dispatchEvent(event, payload)
    }

    private renderCallback: ControllerRenderCallback = (content: string | Node) => {
        removeAllChildren(this.host)

        if (typeof content === "string") {
            this.host.innerHTML = content
        } else {
            this.host.appendChild(content)
        }
    }

    dispatchEvent(event: string, payload?: any) {
        payload = payload || null

        Promise.resolve()
            .then(() => {
                if (isControllerEventHandler(this.handler)) {
                    this.handler.call(null, event, payload, this.renderCallback, this.emit)
                } else {
                    this.handler.handleEvent(event, payload, this.renderCallback, this.emit)
                }
            })
    }
}

function isControllerEventHandler(handler: ControllerInstance): handler is ControllerEventHandler {
    return typeof handler === "function"
}
