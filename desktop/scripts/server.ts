/*import { Hono } from "hono"
import { cors } from "hono/cors"
import { buildAgents } from "@/lib/agents/write"
import type { ChatSettingsStored } from "@/lib/chat-settings"


const app = new Hono()
app.use("*", cors())

app.post("/health", (c) => {
    return c.json({ message: "ok" })
})

app.post("/run-agent", async (c) => {
    const { agent, instruction, targetDoc, userId, settings } = await c.req.json() as {
        agent: string
        instruction: string
        targetDoc?: string | null
        userId: string
        settings: ChatSettingsStored
    }



})

const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: app.fetch,
})
    */

