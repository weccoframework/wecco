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
import { emit } from "cluster";

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
 * `RenderContext` specifies the type for context objects that allow an element to interact
 * with it's surrounding context.
 */
export interface RenderContext {
    /**
     * `requestUpdate` notifies the component to update it's DOM representation (normally due do a change
     * of a a `data` field).
     */
    requestUpdate(): RenderContext

    /**
    * `emit` emits a `CustomEvent` that bubbles up the DOM element hierarchy
    */
    emit(event: string, payload?: any): RenderContext

    /**
     * `addEventListener` subscribes for `CustomEvents` emitted via `emit`.
     */
    addEventListener(event: string, listener: (payload?: any) => void): RenderContext
}

/**
 * `RenderCallback` defins the type for functions that are passed to `define` in order to produce an element's content
 */
export type RenderCallback<T> = (data: T, context: RenderContext) => RenderResult

/**
 * Type definition for a factory function that gets returned from `define` as a convenience function
 * to create new instances of the defined component.
 */
export type ComponentFactory<T> = (data?: T, host?: string | Element) => WeccoElement<T>

/**
 * Name of the `CustomEvent` emitted when using `WeccoElement`'s built-in eventing mechanism.
 */
export const WeccoCustomEventName = "weccoEvent"

/**
 * Interface describing the type of `details` objects sent with custom events.
 */
export interface WeccoCustomEventDetails {
    name: string,
    payload?: any,
}

/**
 * `WeccoElement` defines the base class for all custom elements created by wecco.
 * Subclasses of this class are generated for each element which gets `define`d. They conform to the custom web components protocol.
 */
export abstract class WeccoElement<T> extends HTMLElement {
    /** The render callback function that has been passed to `define` in order to render this element's content */
    protected abstract get renderCallback(): RenderCallback<T>

    /** List of attribute names to observe for changes */
    protected abstract get observedAttributes(): Array<keyof T>

    /** The bound data */
    private data: T = {} as T

    /** Flag that marks whether this component is connected to the DOM or not. */
    private connected = false

    /** Listeners for events */
    private eventListeners = new Map<string, Array<(payload?: any) => void>>()

    /** The render context instance to use */
    private renderContext: RenderContext = new WeccoElementRenderContext(this)

    /** Flag that marks whether an update has been requested */
    private updateRequested = false

    /**
     * Partially updates the bound data with the data given in `data`.
     * @param data the partial data to update
     */
    setData(data: Partial<T>) {
        if (data) {
            Object.keys(data).forEach(k => (this.data as any)[k] = (data as any)[k])
        }

        if (this.connected) {
            this.requestUpdate()
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
    requestUpdate = () => {
        if (this.updateRequested) {
            return
        }

        this.updateRequested = true
        setTimeout(this.executeUpdate.bind(this), 1)
    }

    /**
     * `executeUpdate` performs an update in case the dirty flag has been set.
     */
    private executeUpdate() {
        if (!this.updateRequested) {
            return
        }

        Promise.resolve()
            .then(() => {
                const observed = (this as any).observedAttributes as Array<string>;
                Object.keys(this.data).forEach(k => {
                    if (observed.indexOf(k) > -1) {
                        this.setAttribute(k, (this.data as any)[k])
                    }
                })
                this.updateDom(true)
            })
    }

    emit = (eventName: string, payload?: any) => {
        const event = new CustomEvent(WeccoCustomEventName, {
            detail: {
                name: eventName,
                payload: payload,
            },
            bubbles: true,
            cancelable: true,
            composed: true, // Enables bubbling beyond shadow root
        })
        this.dispatchEvent(event)
    }

    addCustomEventListener(event: string, listener: (payload?: any) => void) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, [])
        }

        this.eventListeners.get(event).push(listener)
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    connectedCallback() {
        Array.prototype.forEach.call(this.attributes, (attr: Attr) => {
            if (this.observedAttributes.indexOf(attr.name as any) !== -1) {
                (this.data as any)[attr.name] = attr.value
            }
        })

        super.addEventListener(WeccoCustomEventName, this.handleWeccoEvent)

        this.connected = true

        this.updateDom()
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    disconnectedCallback() {
        this.childNodes.forEach(this.removeChild.bind(this))
        this.removeEventListener(WeccoCustomEventName, this.handleWeccoEvent)
        this.connected = false
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        const object = {} as any
        object[name] = newValue
        this.setData(object as Partial<T>)
    }

    private handleWeccoEvent = (e: CustomEvent) => {
        const { name, payload } = e.detail

        if (!this.eventListeners.has(name)) {
            return
        }

        e.preventDefault()
        e.stopPropagation()

        this.eventListeners.get(name).forEach(listener => listener(payload))
    }

    private updateDom(removePreviousDom: boolean = false) {
        if (removePreviousDom) {
            let host: Node

            if (this.shadowRoot) {
                host = this.shadowRoot
            } else {
                host = this
            }

            removeAllChildren(host)
        }

        this.eventListeners.clear()

        const elementBody = this.renderCallback(this.data || ({} as T), this.renderContext)
        this.updateRequested = false

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
}

/**
 * Implementation of `RenderContext` for a `WeccoElement`
 */
class WeccoElementRenderContext<T> implements RenderContext {
    constructor(private component: WeccoElement<T>) { }

    /**
     * `requestUpdate` notifies the component to update it's DOM representation (normally due do a change
     * of a a `data` field).
     */
    requestUpdate(): RenderContext {
        this.component.requestUpdate()
        return this
    }

    /**
    * `emit` emits a `CustomEvent` that bubbles up the DOM element hierarchy
    */
    emit(event: string, payload?: any): RenderContext {
        this.component.emit(event, payload)
        return this
    }

    /**
     * `addEventListener` subscribes for `CustomEvents` emitted via `emit`.
     */
    addEventListener(event: string, listener: (payload?: any) => void): RenderContext {
        this.component.addCustomEventListener(event, listener)
        return this
    }

}

export function define<T>(name: string, renderCallback: RenderCallback<T>, observedAttribute: keyof T): ComponentFactory<T>
export function define<T>(name: string, renderCallback: RenderCallback<T>, ...observedAttribute: Array<keyof T>): ComponentFactory<T>
export function define<T>(name: string, renderCallback: RenderCallback<T>, observedAttributes: Array<keyof T>): ComponentFactory<T>

/**
 * `define` is used to define a new wecco component which is also a custom element.
 * The render callback provided to define will be called whenever the element`s content needs to be updated.
 * @param name the name of the custom element. Must follow the custom element specs (i.e. the name must contain a dash)
 * @param renderCallback the render callback
 * @param observedAttributes list of attribute names to observe for changes and bind to data
 * @returns an instance of a `ComponentFactory` which can produce instances of the defined component
 */
export function define<T>(name: string, renderCallback: RenderCallback<T>, ...observedAttributes: Array<Array<keyof T> | keyof T>): ComponentFactory<T> {
    const observedAttributesValue: Array<keyof T> = observedAttributes.map(a => Array.isArray(a) ? a : [a]).reduce((a, v) => a.concat(v), [])

    window.customElements.define(name, class extends WeccoElement<T> {
        protected renderCallback = renderCallback
        protected observedAttributes = observedAttributesValue

        /**
         * Getter used to retrieve the list of attribute names to watch for changes.
         */
        static get observedAttributes() {
            return observedAttributesValue
        }
    })
    return component.bind(null, name)
}

/**
 * Creates an instance of a `define`d element which will use the given `data` and will be added to the given `host` element.
 * This is an alternative approach to using the `ComponentFactory` returned by `define` which does not require a handle
 * to the component factory but uses the browser's built-in registry for custom web components.
 * 
 * The following two snippets as essentially the same:
 * 
 * ```typescript
 * const SomeComponent = define("some-component", (data: SomeComponentData, requestUpdate) => {
 *      // ..
 * })
 * 
 * SomeComponent({}).mount("#body")
 * ```
 * vs.
 * ```typescript
 * define("some-component", (data: SomeComponentData, requestUpdate) => {
 *      // ..
 * })
 * 
 * component("some-component", SomeComponent({}).mount("#body")
 * ```
 * 
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

    el.setData(data)

    if (typeof host !== "undefined" && host !== null) {
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
