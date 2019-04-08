/*
 * This file is part of wecco.
 * 
 * Copyright (c) 2019 Alexander Metzner.
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

/**
 * `BindElementCallback` defines a type used by functions that apply elements to another element.
 */
export type BindElementCallback = (host: Node) => void

/**
 * `ContentProducer` defines types that produce an element's content on request.
 */
export interface ContentProducer {
    /**
     * Called to create the element's content.
     * @param host the element to create content for
     */
    render(host: Node): void
}

/**
 * `NotifyUpdateCallback` defines the type for functions that are called to notify of an element update.
 */
export type NotifyUpdateCallback = () => void

/**
 * `EmitEventCallback` defines the type of functions that emit an event.
 */
export type EmitEventCallback = (event: string, payload?: any) => void

/**
 * `RenderResult` defines the type of data returned from a `RenderCallback`.
 * 
 * It is one of the following
 * * `string` - any string that is used to set an element's `innerHtml`
 * * `Node` - a DOM Node to be appended as a child
 * * `BindElementCallback` - which is used to dynamically provide a `Node`'s content
 * * `ContentProducer` - an instance of a class implementing the `ContentProducer` interface
 */
export type RenderResult = string | Node | BindElementCallback | ContentProducer

/**
 * `RenderCallback` defins the type for functions that are passed to `define` in order to produce an element's content
 */
export type RenderCallback<T> = (data: T, updater: NotifyUpdateCallback, emit: EmitEventCallback) => RenderResult

/**
 * Type definition for a factory function that gets returned from `define` as a convenience function
 * to create new instances of the defined component.
 */
export type ComponentFactory<T> = (data?: T, host?: string | Element) => WeccoElement<T>

/**
 * `WeccoElement` defines the base class for all custom elements created by wecco.
 * Subclasses of this class are generated for each element which gets `define`d. They conform to the custom web components protocol.
 */
export abstract class WeccoElement<T> extends HTMLElement {
    /** The render callback function that has been passed to `define` in order to render this element's content */
    protected abstract get renderCallback(): RenderCallback<T>

    /** The context this element belongs to */
    eventEmitter: EmitEventCallback = () => { }

    /** The bound data */
    private data: T

    constructor() {
        super()
    }

    /**
     * Called to bind data to this element.
     * @param data the data
     */
    bindData(data: T) {
        this.data = data
        if (this.isConnected) {
            this.updateDom(true)
        }
    }

    /**
     * Mounts this element to the DOM node passed to this method.
     * @param elementOrSelector either the element or an selector, which gets resolved using `document.querySelector`
     */
    mount(elementOrSelector: ElementSelector) {
        resolve(elementOrSelector).appendChild(this)
    }

    /**
     * Callback to invoke in order to trigger an update of this element
     */
    notifyUpdate: NotifyUpdateCallback = () => {
        Promise.resolve()
            .then(this.updateDom.bind(this, true))
    }

    private updateDom(removePreviousDom: boolean = false) {
        // TODO: Optimize by traversing and comparing elements

        if (removePreviousDom) {
            let host: Node

            if (this.shadowRoot) {
                host = this.shadowRoot
            } else {
                host = this
            }

            removeAllChildren(host)
        }

        const elementBody = this.renderCallback(this.data || ({} as T), this.notifyUpdate, this.eventEmitter)

        if (elementBody) {
            if (typeof elementBody === "string") {
                this.innerHTML = elementBody
            } else if (elementBody instanceof Node) {
                this.appendChild(elementBody as Node)
            } else if (isElementContentProducer(elementBody)) {
                elementBody.render(this)
            } else if (typeof elementBody === "function") {
                (elementBody as BindElementCallback).call(null, this)
            } else {
                console.error("Got unexpected result from render callback: ", elementBody)
            }
        }
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    connectedCallback() {
        let parent = this.parentElement
        while (parent !== null) {
            if (parent === document.body) {
                break
            }

            if (parent instanceof WeccoElement) {
                this.eventEmitter = parent.eventEmitter
                break
            }

            parent = parent.parentElement
        }

        this.updateDom()
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    disconnectedCallback() {
        this.eventEmitter = () => { }
        this.childNodes.forEach(this.removeChild.bind(this))
    }
}

/**
 * `define` is used to define a new wecco component which is also a custom element.
 * The render callback provided to define will be called whenever the element`s content needs to be updated.
 * @param name the name of the custom element. Must follow the custom element specs (i.e. the name must contain a dash)
 * @param renderCallback the render callback
 */
export function define<T>(name: string, renderCallback: RenderCallback<T>): ComponentFactory<T> {
    window.customElements.define(name, class extends WeccoElement<T> {
        protected renderCallback = renderCallback
    })
    return component.bind(null, name)
}

/**
 * Creates an instance of a `define`d element which will use the given `data` and will be added to the given `host` element.
 * @param componentName the component name
 * @param data the bound data
 * @param host the host to add the component to
 */
export function component<T>(componentName: string, data?: T, host?: string | Element): WeccoElement<T> {
    const el = document.createElement(componentName) as WeccoElement<T>

    if (!(el instanceof WeccoElement)) {
        console.error("Element is not a defined Weco element:", el)
        return
    }

    el.bindData(data)

    if (host != null) {
        el.mount(host)
    }

    return el
}

/**
 * Type Guard to tell wether a rendering result is a `ContentProducer`.
 * @param c the rendering result
 */
function isElementContentProducer(c: RenderResult): c is ContentProducer {
    return typeof c === "object" && typeof (<any>c)["render"] === "function"
}
