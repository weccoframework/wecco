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
export interface RenderContext<T> {
    /**
     * Getter to obtain the data used to render the element.
     */
    get data(): T

    /**
     * `requestUpdate` notifies the component to update it's DOM representation (normally due do a change
     * of a a `data` field).
     */
    requestUpdate: () => void

    /**
    * `emit` emits a `CustomEvent` that bubbles up the DOM element hierarchy
    */
    emit: (event: string, payload?: any) => void

    /**
     * `addEventListener` subscribes for `CustomEvents` emitted via `emit`.
     */
    addEventListener: (event: string, listener: (payload?: any) => void) => void

    /**
     * `once` provides a way to execute a given callback once and just once no matter how
     * often the render callback gets called.
     * @param id a unique id used to identify the callback
     * @param callback the callback to execute once
     */
    once: (id: string, callback: OnceCallback) => void
}

/**
 * `RenderCallback` defins the type for functions that are passed to `define` in order to produce an element's
 * content.
 */
export type RenderCallback<T> = (context: RenderContext<T>) => ElementUpdate

/**
 * Type definition for a factory function that gets returned from `define` as a convenience function
 * to create new instances of the defined component.
 */
export type ComponentFactory<T> = (data?: T, host?: string | Element) => WeccoElement<T>

/** Custom event name dispatched by a wecco custom element when redering is complete */
export type RenderingCompleteEvent = "renderingComplete"

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
    private _data: T = {} as T

    /** Flag that marks whether this component is connected to the DOM or not. */
    private _connected = false

    /** The render context instance to use */
    private readonly _renderContext = new WeccoElementRenderContext<T>(this)

    /** Flag that marks whether an update has been requested */
    private _updateRequested = false

    /** 
     * A set of ids of callbacks provided to `RenderContext.once` that have been executed.
     */
    private _executedOnceCallbackIds = new Set<string>()

    /**
     * Partially updates the bound data with the data given in `data`.
     * @param data the partial data to update
     * @returns this to enable invocation chaining
     */
    setData(data?: Partial<T>): WeccoElement<T> {
        if (data) {
            Object.keys(data).forEach(k => (this._data as any)[k] = (data as any)[k])
        }

        if (this._connected) {
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
        if (this._updateRequested) {
            return
        }

        this._updateRequested = true
        Promise.resolve().then(this.executeUpdate.bind(this))
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
                (this._data as any)[attr.name] = attr.value
            }
        })

        this._connected = true

        this.updateDom()
        this.emit("connect")
    }

    /**
     * (Life cycle method)[https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#Using_the_lifecycle_callbacks] for the custom element.
     */
    disconnectedCallback() {
        this.childNodes.forEach(this.removeChild.bind(this))
        this._connected = false
        this.emit("disconnect")
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
        if (this._executedOnceCallbackIds.has(id)) {
            return
        }

        this._executedOnceCallbackIds.add(id)

        Promise.resolve()
            .then(() => {
                callback()
            })
    }

    /**
     * `executeUpdate` performs an update in case the dirty flag has been set.
     */
    private executeUpdate() {
        if (!this._updateRequested) {
            return
        }

        if (!this._connected) {
            return
        }

        Promise.resolve()
            .then(() => {
                const observed = (this as any).observedAttributes as Array<string>;
                Object.keys(this._data).forEach(k => {
                    if (observed.indexOf(k) > -1) {
                        this.setAttribute(attributeNameForModelKey(k), stringifyAttributeValue((this._data as any)[k]))
                    }
                })
                this.updateDom()
            })
    }

    private updateDom() {
        this._renderContext.data = this._data
        const elementUpdate = this.renderCallback(this._renderContext)
        this._updateRequested = false

        updateElement(this, elementUpdate)
        this.dispatchEvent(new CustomEvent("renderingComplete"))
    }
}

function stringifyAttributeValue(v: any): string {
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
class WeccoElementRenderContext<T> implements RenderContext<T> {
    public data: T | undefined

    constructor(private component: WeccoElement<T>) { }

    requestUpdate = () => {
        this.component.requestUpdate()
        return this
    }

    emit = (event: string, payload?: any) => {
        this.component.emit(event, payload)
        return this
    }

    addEventListener = (event: string, listener: (payload?: any) => void) => {
        this.component.addEventListener(event, listener)
        return this
    }

    once = (id: string, callback: OnceCallback) => {
        this.component.registerOnceCallback(id, callback)
        return this
    }
}

/**
 * Additional options that may be passed to `define`. 
 * @param T the type of data being used to define the component
 */
export interface DefineOptions<T> {
    /** List of element attributes (shown up in HTML) to observe and bind to data fields */
    observedAttributes?: Array<keyof T>
    /** List of element Javascript properties to observe and bind to data fields */
    observedProperties?: Array<keyof T>
}

/**
 * `define` is used to define a new wecco component which is also a custom element.
 * The render callback provided to define will be called whenever the element`s content needs to be updated.
 * @param name the name of the custom element. Must follow the custom element specs (i.e. the name must contain a dash)
 * @param renderCallback the render callback
 * @param options additional options used to customize the element
 * @returns an instance of a `ComponentFactory` which can produce instances of the defined component
 */
export function define<T>(name: string, renderCallback: RenderCallback<T>, options?: DefineOptions<T>): ComponentFactory<T> {
    const observedAttributesValue: Array<keyof T> = options?.observedAttributes?.map(a => Array.isArray(a) ? a : [a]).reduce((a, v) => a.concat(v), []) ?? []
    const observedAttributeNames = observedAttributesValue.map(v => attributeNameForModelKey(v as string))

    window.customElements.define(name, class extends WeccoElement<T> {

        constructor() {
            super()

            options?.observedProperties?.forEach(p => {
                Object.defineProperty(this, p, {
                    configurable: false,
                    enumerable: true,
                    get() {
                        return this._data[p]
                    },
                    set(newValue: any) {
                        this.setData({ [p]: newValue })
                    }
                })
            })
        }

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

    el.setData(data)

    if (typeof host !== "undefined" && host !== null) {
        el.mount(host)
    }

    return el
}
