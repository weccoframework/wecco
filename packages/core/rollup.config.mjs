import typescript from "@rollup/plugin-typescript"
import commonjs from "@rollup/plugin-commonjs"
import terser from "@rollup/plugin-terser"

import { readFileSync } from "fs"
const { version } = JSON.parse(readFileSync("./package.json"))


export default [
    {
        input: "./index.ts",

        output: [
            {
                file: `dist/index.mjs`,
                name: "@weccoframework/core",
                format: "es",
                sourcemap: true
            },

            {
                file: `dist/index.js`,
                format: "cjs",
                sourcemap: true
            },
        ],

        plugins: [
            typescript({
                compilerOptions: {
                    module: "ESNext",
                },
            }),
            commonjs(),
        ]
    },

    {
        input: "./index.ts",

        output: [
            {
                file: "dist/weccoframework-core.min.js",
                format: "umd",
                name: "wecco",
                sourcemap: true,
            },

            {
                file: "dist/weccoframework-core.min.mjs",
                name: "@weccoframework/core",
                format: "es",
                sourcemap: true,
            },
        ],

        plugins: [
            typescript({
                compilerOptions: {
                    module: "ESNext",
                },
            }),
            commonjs(),
            terser({
                format: {
                    preamble: `/* @weccoframework/core v${version}; Copyright 2019 - 2023 the wecco authors. Published under the terms of the Apache License V2. */`,
                },
            }),

        ]
    },

]
