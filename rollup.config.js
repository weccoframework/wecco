import typescript from "rollup-plugin-typescript2"
import commonjs from "rollup-plugin-commonjs"

export default {
    input: "./index.ts",

    output: [
        {
            file: `dist/weccoframework-core.umd.js`,
            name: "@weccoframework/core",
            format: "umd",
            sourcemap: true
        },
        {
            file: `dist/weccoframework-core.es5.js`,
            format: "es",
            sourcemap: true
        },
    ],

    plugins: [
        typescript({
            tsconfigOverride: {
                compilerOptions: {
                    module: "ESNext",
                },
            },
        }),
        commonjs(),
    ]
}