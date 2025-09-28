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

import { cpus, totalmem, arch, type } from "os"
import { Browser, Page, TestInfo, test as base } from "@playwright/test"

export interface Spec {
    prepare?: () => void | Promise<void>
    sample: () => number | Promise<number>
    cleanup?: () => void | Promise<void>
    iterations?: number
}

interface TestResult {
    info: TestInfo
    duration: number
    iterations: number
}

const defaultIterations = 1000

type Benchmark = (spec: Spec) => Promise<void>

export class Benchmarker {
    private results = [] as Array<TestResult>
    constructor(private readonly browser: Browser) { }

    async run(page: Page, info: TestInfo, spec: Spec) {
        if (spec.prepare) {
            await page.evaluate(spec.prepare)
        }

        const iterations = spec.iterations ?? defaultIterations

        let dur = 0
        for (let i = 0; i < iterations; i++) {
            dur += await page.evaluate(spec.sample)
        }

        if (spec.cleanup) {
            await page.evaluate(spec.cleanup)
        }

        this.results.push({
            info: info,
            duration: dur,
            iterations: iterations,
        })
    }

    printSummary() {
        console.log()
        console.log("BENCHMARK RESULTS")
        console.log(`OS: ${type()} ${arch}`)
        console.log(`CPU: ${cpus()[0].model}`)
        console.log(`Mem: ${(totalmem() / 1024 / 1024 / 1024).toFixed(0)}GB`)
        console.log(`Browser: ${this.browser.browserType().name()}`)
        console.log(formatTable(["Test", "Iterations", "Total Time", "Time per Iteration"], this.results.map(r => [
            r.info.titlePath.slice(2).join(" ▶ "),
            r.iterations.toString(),
            `${r.duration.toFixed(2)} ms`,
            `${(r.duration / r.iterations).toFixed(4)} ms`,
        ])))
        console.log()
    }
}

export const test = base.extend<{ benchmark: Benchmark }, { benchmarker: Benchmarker }>({
    benchmarker: [async ({ browser }, use) => {
        const benchmarker = new Benchmarker(browser)

        await use(benchmarker)

        benchmarker.printSummary()
    }, { scope: "worker" }],

    benchmark: async ({ page, benchmarker }, use, info) => {
        await page.goto('.')
        await use(benchmarker.run.bind(benchmarker, page, info))
    },
})

function formatTable (labels: Array<string>, rows: Array<Array<string>>) {
    const widths = labels.map(l => l.length)
    rows.forEach(row => row.forEach((cell, i) => {
        const w = `${cell}`.length
        if (w > widths[i]) {
            widths[i] = w
        }
    }))

    let r = ""
    let sep = ""

    labels.forEach((l, i) => {
        if (i > 0) {
            r += " | "
            sep += "-+-"
        }
        r += pad(l, widths[i])
        for (let j = 0; j < widths[i]; j++) {
            sep += "-"
        }
    })
    
    r += "\n"
    r += sep

    rows.forEach(row => {
        r += "\n"
        row.forEach((cell, i) => {
            if (i > 0) {
                r += " | "
            }

            r += pad(cell, widths[i])
        })
    })

    return r
}

function pad (s: string, w: number): string {
    if (s.length >= w) {
        return s
    }

    let r = ""
    for (let i = 0; i < w - s.length; i++) {
        r += " "
    }
    r += s
    return r
}