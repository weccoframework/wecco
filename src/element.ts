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
import { ElementUpdate, updateElement } from "./update"

/**
 * `NotifyUpdateCallback` defines the type for functions that are called to notify of an element update.
 */
export type NotifyUpdateCallback = () => void

/**
 * Type for callback functions provided to `RenderContext.once`.
 */
export type OnceCallback = () => void

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

    /**
     * `once` provides a way to execute a given callback once and just once no matter how
     * often the render callback gets called.
     * @param id a unique id used to identify the callback
     * @param callback the callback to execute once
     */
    once(id: string, callback: OnceCallback): RenderContext
}

/**
 * `RenderCallback` defins the type for functions that are passed to `define` in order to produce an element's content
 */
export type RenderCallback<T> = (data: T, context: RenderContext) => ElementUpdate

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

    /** List of attribute names to observe for changes */
    protected abstract get observedAttributes(): Array<keyof T>

    /** The bound data */
    private data: T = {} as T

    /** Flag that marks whether this component is connected to the DOM or not. */
    private connected = false

    /** The render context instance to use */
    private renderContext: RenderContext = new WeccoElementRenderContext(this)

    /** Flag that marks whether an update has been requested */
    private updateRequested = false

    /** 
     * A set of ids of callbacks provided to `RenderContext.once` that have been executed.
     */
    private executedOnceCallbackIds = new Set<string>()

    /**
     * Partially updates the bound data with the data given in `data`.
     * @param data the partial data to update
     * @returns this to enable invocation chaining
     */
    setData(data: Partial<T>): WeccoElement<T> {
        if (data) {
            Object.keys(data).forEach(k => (this.data as any)[k] = (data as any)[k])
        }

        if (this.connected) {
            this.requestUpdate()
        }

        return this
    }

    /**
     * Mounts this element to the DOM node passed to this method.
     * @param elementOrSelector either the element or an selector, which gets resolved using `document.querySelector`
     * @returns this to enable invocation chaining
     */
    mount(elementOrSelector: ElementSelector): WeccoElement<T> {
        resolve(elementOrSelector).appendChild(this)
        return this
    }

    /**
     * Callback to invoke in order to trigger an update of this element
     * @returns this to enable invocation chaining
     */
    requestUpdate: () => WeccoElement<T> = () => {
        if (this.updateRequested) {
            return
        }

        this.updateRequested = true
        setTimeout(this.executeUpdate.bind(this), 1)
        return this
    }

    emit = (eventName: string, payload?: any) => {
        const event = new CustomEvent(eventName, {
            detail: payload,
            bubbles: true,
            cancelable: true,
            composed: true, // Enables bubbling beyond shadow root
        })
        this.dispatchEvent(event)
        return this
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

        this.connected = true

        this.updateDom()
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    disconnectedCallback() {
        this.childNodes.forEach(this.removeChild.bind(this))
        this.connected = false
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        const object = {} as any
        object[modelKeyForAttributeName(name)] = newValue
        this.setData(object as Partial<T>)
    }

    registerOnceCallback(id: string, callback: OnceCallback) {
        if (this.executedOnceCallbackIds.has(id)) {
            return
        }

        this.executedOnceCallbackIds.add(id)

        Promise.resolve()
            .then(() => {
                callback()
            })
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
                        this.setAttribute(attributeNameForModelKey(k), stringifyAttributeValue((this.data as any)[k]))
                    }
                })
                this.updateDom()
            })
    }

    private updateDom() {
        const elementUpdate = this.renderCallback(this.data || ({} as T), this.renderContext)
        this.updateRequested = false

        updateElement(this, elementUpdate)
    }
}

function stringifyAttributeValue (v: any): string {
    if (!v) {
        return ""
    }

    if (typeof v === "string") {
        return v
    }

    return `${v}`
}

/**
 * Implementation of `RenderContext` for a `WeccoElement`
 */
class WeccoElementRenderContext<T> implements RenderContext {
    constructor(private component: WeccoElement<T>) { }

    requestUpdate(): RenderContext {
        this.component.requestUpdate()
        return this
    }

    emit(event: string, payload?: any): RenderContext {
        this.component.emit(event, payload)
        return this
    }

    addEventListener(event: string, listener: (payload?: any) => void): RenderContext {
        this.component.addEventListener(event, listener)
        return this
    }

    once(id: string, callback: OnceCallback): RenderContext {
        this.component.registerOnceCallback(id, callback)
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
    const observedAttributeNames = observedAttributesValue.map(v => attributeNameForModelKey(v as string))

    window.customElements.define(name, class extends WeccoElement<T> {
        protected renderCallback = renderCallback
        protected observedAttributes = observedAttributesValue

        /**
         * Getter used to retrieve the list of attribute names to watch for changes.
         */
        static get observedAttributes() {
            return observedAttributeNames
        }
    })
    return component.bind(null, name)
}

/**
 * Converts the name of a model attribute to a corresponding HTML attribute name.
 * This is basically a conversion from camel case to dash case.
 * @param modelKey the model key name
 * @returns the corresponding attribute name
 */
function attributeNameForModelKey(modelKey: string): string {
    let result = ""
    let wasUpper = false

    for (let c of modelKey) {
        if (c.toUpperCase() === c) {
            if (wasUpper) {
                result += "-"
            }
            result += c.toLowerCase()
            wasUpper = true
        } else {
            result += c
            wasUpper = false
        }
    }

    return result
}

/**
 * Converts the name of a HTML attribute to a corresponding model attribute.
 * This is basically a conversion from dash case to camel case.
 * @param attributeName the attribute name
 * @returns the corresponding model key name
 */
function modelKeyForAttributeName(attributeName: string): string {
    let result = ""
    let wasDash = false

    for (let c of attributeName) {
        if (c === "-") {
            wasDash = true
        } else if (wasDash) {
            result += c.toUpperCase()
            wasDash = false
        } else {
            result += c
        }
    }

    return result
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
