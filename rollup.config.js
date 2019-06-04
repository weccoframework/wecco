import typescript from "rollup-plugin-typescript2"
import commonjs from "rollup-plugin-commonjs"

// const pkg = require("./package.json")

export default {
    input: "./index.ts",

    output: [
        {
            file: `dist/wecco-core.umd.js`,
            name: "wecco",
            format: "umd",
            sourcemap: true
        },
        {
            file: `dist/wecco-core.es5.js`,
            format: "es",
            sourcemap: true
        },
    ],

    // external: [
    //     ...Object.keys(pkg.dependencies || {}),
    //     ...Object.keys(pkg.peerDependencies || {}),
    // ],

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