import { defineConfig } from "@playwright/test"

export default defineConfig({
    webServer: {
        command: "npm run acceptance-test-server",
        url: "http://localhost:8888/",
        timeout: 10 * 1000,
        reuseExistingServer: !process.env.CI,
    },
    use: {
        baseURL: "http://localhost:8888/",
    },
    projects: [
        {
          name: "acceptance",
          testMatch: /test\/acceptance\/.*.spec.[js|ts]/,
          retries: 0,
        },
        {
          name: "performance",
          testMatch: /test\/performance\/.*.spec.[js|ts]/,
          retries: 0,
        },
    ],    
})
