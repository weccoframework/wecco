import typescript from "@rollup/plugin-typescript"
import commonjs from "@rollup/plugin-commonjs"
import terser from '@rollup/plugin-terser'

export default {
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
        terser(),
    ]
}