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

import { ElementUpdateFunction, ElementUpdate, updateElement } from "./dom"

/**
 * `DoWithShadowCallback` can be used to automatically create a `ShadowRoot` for an element.
 */
export type DoWithShadowCallback = (shadow: ShadowRoot) => void

/**
 * Used to create a [`ShadowRoot`](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot) and add content to it. 
 * @param content the callback to add content to the shadow root
 */
export function shadow(content: DoWithShadowCallback | ElementUpdate): ElementUpdateFunction {
    return (host: Element) => {
        const shadow = host.shadowRoot || host.attachShadow({ mode: "open" })
        if (typeof content === "function") {
            content.call(null, shadow)
        } else {
            updateElement(shadow.getRootNode() as Element, content)
        }
    }
}
