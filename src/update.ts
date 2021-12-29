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

import { ElementSelector, removeAllChildren, resolve } from "./dom"

/**
 * `UpdateTarget` defines the type of a target of an update operation.
 * It may either be a regular HTML `Element` or a `DocumentFragment` which
 * is used as the `content` node for a HTML `template`.
 */
export type UpdateTarget = Element | DocumentFragment

/**
 * `ElementUpdateFunction` defines a type for callable objects that updates a target's content.
 */
export interface ElementUpdateFunction {
    (host: UpdateTarget): void
}

/** 
 * `ElementUpdater` defines an interface for complex objects (those that carry methods) that
 * perform an update of a given target.
 */
export interface ElementUpdater {
    /**
     * `updateElement` updates the content of the given target at the given `insertPoint`.
     * @param el the target to update
     */
    updateElement(el: UpdateTarget): void
}

/**
 * `ElementUpdate` defines the possible types for update requests.
 * - `string`s will be used to define `innerText`
 * - `Element`s should be inserted/appended
 * - `ElementUpdateFunction` or `ElementUpdater` are applied
 * - arrays of the afore mentioned are applied in sequence
 */
export type ElementUpdate = string | Element | ElementUpdateFunction | ElementUpdater | Array<ElementUpdate>

/**
 * `isElementUpdate` is a type guard that checks whether the given argument is an `ElementUpdate`.
 * Note that this function does not check the value for being a `string`. 
 * @param arg the argument to check
 */
export function isElementUpdate(arg: any): arg is ElementUpdate {
    return (typeof arg === "function") || Array.isArray(arg) || (arg instanceof Element) || isElementUpdater(arg)
}

/**
 * `updateElement` applies the given update request to the given target.
 * @param target the target to update
 * @param request the request
 * @param notifyUpdated whether to send an update event after the element update
 */
export function updateElement(target: UpdateTarget | ElementSelector, request: ElementUpdate, notifyUpdated?: boolean): void {
    notifyUpdated = notifyUpdated ?? true

    const targetElement = typeof target === "string"
        ? resolve(target)
        : target

    // Execute the update. Never let a downstream updater
    // send an update notification.
    executeElementUpdate(targetElement, request)

    // If this call is the root of the update cycle, send
    // the update notification.
    if (notifyUpdated) {
        sendUpdateEvent(targetElement)
    }
}

/**
 * Dispatches an `update` event for every node found under `targetElement`.
 * The update event is a `CustomEvent` with type `"update"` that does
 * not bubble.
 * @param targetElement the root of the update
 */
function sendUpdateEvent(targetElement: UpdateTarget): void {
    if (!targetElement.isConnected) {
        // If the element is not connected to a document root, we do not send any update here.
        return
    }

    // Send update event for all elements not visiting neither custom elements nor their sub-trees.
    let treeWalker = document.createTreeWalker(targetElement, NodeFilter.SHOW_ELEMENT, ExcludeCustomElementsFilter)
    let e: Node
    while (e = treeWalker.nextNode()) {
        (e as EventTarget).dispatchEvent(new CustomEvent("update", {
            // Don't let the event bubble up the DOM. An individual event
            // will be dispatched for every element that is part of the
            // update.
            bubbles: false,
        }))
    }

    // Send update event for all custom elments but only custom elements alone - not their sub-trees.
    treeWalker = document.createTreeWalker(targetElement, NodeFilter.SHOW_ELEMENT, OnlyCustomElementsFilter)
    while (e = treeWalker.nextNode()) {
        (e as EventTarget).dispatchEvent(new CustomEvent("update", {
            // Don't let the event bubble up the DOM. An individual event
            // will be dispatched for every element that is part of the
            // update.
            bubbles: false,
        }))
    }

}

/**
 * A NodeFilter that accepts all elements except custom elements (those that contain a - in their node name).
 * This filter is meant to be used to trigger update events reject custom elements which means to skip both 
 * the element itself as well as the element's children. This prevents sending update events twice per render
 * cycle for custom elements with nested html templates.
 */
const ExcludeCustomElementsFilter: NodeFilter = (node: Node): number => {
    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.indexOf("-") >= 0) {
        return NodeFilter.FILTER_REJECT
    }

    return NodeFilter.FILTER_ACCEPT
}


const OnlyCustomElementsFilter: NodeFilter = (node: Node): number => {
    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName.indexOf("-") >= 0) {
        return NodeFilter.FILTER_ACCEPT
    }

    return NodeFilter.FILTER_REJECT
}


function executeElementUpdate(targetElement: UpdateTarget, request: ElementUpdate): void {
    if (Array.isArray(request)) {
        // An array of requests. Apply one at a time to a DocumentFragment
        // and move the resulting elements under target.
        // Clear the target element upfront to get a "fresh" starting point.
        removeAllChildren(targetElement)

        request.forEach(r => {
            const fragment = document.createDocumentFragment()
            updateElement(fragment, r)
            targetElement.appendChild(fragment)
        })

        return
    }

    if (typeof request === "string") {
        // Create a text node containing the request's value
        // and append it to target.
        // Clear the target element upfront to get a "fresh" starting point.
        removeAllChildren(targetElement)

        targetElement.appendChild(document.createTextNode(request))

        return
    }

    if (request instanceof Element) {
        // Append the element directly.
        // Clear the target element upfront to get a "fresh" starting point.
        removeAllChildren(targetElement)

        targetElement.appendChild(request)

        return
    }

    if (isElementUpdater(request)) {
        // Call the update element method of the updater.
        // The target element is not cleared before applying
        // the update. This is either the updater's responsibility
        // or the updater may "reuse" the previous DOM subtree.
        request.updateElement(targetElement)
        return
    }

    // A bare update function. As for the ElementUpdater    
    // branch above, the target element is not cleared.
    request(targetElement)
}

function isElementUpdater(request: ElementUpdate): request is ElementUpdater {
    return (typeof request === "object") && ("updateElement" in request)
}