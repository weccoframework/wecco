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

export type EventCallback = any
export type EventType = string

interface Listener {
    type: EventType
    callback: EventCallback
}

export class EventRegistry {
    static readonly instance = new EventRegistry()

    private registeredListeners = new WeakMap<EventTarget, Array<Listener>>()

    addEventListener(target: EventTarget, type: EventType, callback: EventCallback) {
        target.addEventListener(type, callback)
        
        const a: Array<Listener> = this.registeredListeners.has(target)
            ? this.registeredListeners.get(target)
            : []
        a.push({
            type,
            callback,
        })
        this.registeredListeners.set(target, a)
    }

    removeAllEventListeners(target: EventTarget, type: EventType) {
        if (!this.registeredListeners.has(target)) {
            return
        }

        this.registeredListeners.get(target).forEach(l => {
            if (l.type === type) {
                target.removeEventListener(l.type, l.callback)
            }
        })
        this.registeredListeners.delete(target)
    }
}