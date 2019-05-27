const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")

module.exports = {
    mode: "development",
    entry: "./index.ts",
    output: {
        filename: "bundle.js"
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: "ts-loader"
            }
        ]
    },
    resolve: {
        extensions: [".ts", ".js", ".html"],
        plugins: [new TsconfigPathsPlugin()]
    },
    devServer: {
        contentBase: "./public",
        host: "0.0.0.0",
        compress: true,
        port: 9999
    }
}