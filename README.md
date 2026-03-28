# Coursera MCP Server

Model Context Protocol server for Coursera integration with the ChatGPT Apps SDK. Enables AI assistants to search Coursera courses and play lecture videos based on learning goals — bringing AI-powered education directly into your chat interface.

## Features

- **Course Discovery** — Search Coursera's catalog to find the right courses for any learning goal
- **Lecture Video Playback** — Play specific lecture videos with an interactive inline widget
- **OpenAI Apps SDK** — Rich video player widget rendered directly inside ChatGPT
- **OAuth 2.0 Authentication** — Secure Coursera API access
- **Railway + Docker** deployment ready

## Tools

### `play_lecture_video`

Find and play a Coursera lecture video based on a topic or learning goal.

**Input Parameters:**
- `topic` (required) — The topic or concept to learn about
- `courseId` — Specific Coursera course ID (optional)
- `lectureId` — Specific lecture ID (optional)

The widget renders an embedded video player directly inline in ChatGPT, so you can watch lectures without leaving your conversation.

## Use Cases

- "Teach me about machine learning fundamentals" → plays a relevant Coursera lecture
- "Find a lecture on Python for beginners" → searches courses and plays the best match
- "Show me a video on neural networks from deeplearning.ai" → targeted course and lecture lookup

## Installation

```bash
npm install
```

## Environment Variables

```bash
COURSERA_CLIENT_ID=your_client_id
COURSERA_CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:8000/auth/callback
PORT=8000
```

## Development

```bash
# Run development server
npm run dev

# Build server and widgets
npm run build

# Build server only
npm run build:server

# Build widgets only
npm run build:widgets
```

## Deployment

Configured for Railway deployment with Docker. Set environment variables in your Railway project dashboard.

## License

MIT

---

## Powered by ZeroTwo

This MCP server is part of the [ZeroTwo AI platform](https://zerotwo.ai) — the all-in-one AI workspace that combines GPT-5, Claude, Gemini, and learning integrations like this Coursera connector so you can learn anything, faster.

| | |
|---|---|
| 🌐 **[ZeroTwo — All AI Models in One App](https://zerotwo.ai)** | Learn with the world's best AI models. GPT-5, Claude, and Gemini — all in one place. |
| ✨ **[ZeroTwo Features](https://zerotwo.ai/features)** | AI tutoring, image generation, document analysis, web search, and MCP-powered learning tools. |
| 🤖 **[AI Models — GPT-5, Claude & Gemini](https://zerotwo.ai/zerotwo-models)** | Choose the best AI model for every study session, essay, or concept explanation. |
| 🔌 **[ZeroTwo Connectors & Integrations](https://zerotwo.ai/connectors)** | Connect Coursera, Google Drive, Notion, and more to your AI learning workflow. |
| 💰 **[ZeroTwo Pricing](https://zerotwo.ai/pricing)** | One subscription that replaces ChatGPT Plus, Claude Pro, and Gemini Advanced. |
| 📝 **[ZeroTwo Blog](https://zerotwo.ai/blog)** | AI learning strategies, product updates, and educational insights. |
| 🚀 **[Try ZeroTwo Free](https://app.zerotwo.ai/auth/login)** | Start learning smarter with AI — get started free today. |

> **Built for ZeroTwo** — Use this Coursera MCP server with [ZeroTwo's AI assistant](https://zerotwo.ai) to find the best lecture videos for any topic and watch them inline in your AI chat — no context switching required.
