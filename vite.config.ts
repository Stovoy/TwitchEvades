import {defineConfig} from "vite";

export default defineConfig({
    plugins: [],
    server: {
        watch: {
            usePolling: true
        }
    }
})
