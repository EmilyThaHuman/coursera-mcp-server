# Coursera MCP Server with OpenAI Apps SDK

A TypeScript-based Model Context Protocol (MCP) server that integrates Coursera course search with ChatGPT using the OpenAI Apps SDK. This server provides an interactive video player widget for discovering and previewing Coursera courses based on learning goals.

## Features

- **🎓 Course Discovery** - Search courses by learning goals and topics
- **🎬 Video Preview Player** - Beautiful interactive widget with course previews
- **📊 Rich Course Information** - Ratings, enrollments, duration, skills, and more
- **🌍 Multi-language Support** - Filter courses by language
- **📈 Difficulty Levels** - Filter by beginner, intermediate, or advanced
- **Real API Integration** - Uses RapidAPI for live course data (with mock data fallback)
- **Cloudflare Workers Ready** - Deploy globally with zero-config scaling
- **TypeScript** - Fully typed for better development experience

## Project Structure

```
coursera-mcp-server/
├── src/
│   └── server.ts          # Node.js MCP server
├── ui-components/
│   └── play-lecture-video.html   # Course video player widget
├── package.json
├── tsconfig.json
├── wrangler.toml          # Cloudflare Workers config
└── README.md
```

## Prerequisites

- Node.js 18+
- npm or pnpm
- Cloudflare account (for deployment)
- Wrangler CLI (for Cloudflare deployment)

## Installation

```bash
# Navigate to the project
cd coursera-mcp-server

# Install dependencies
npm install
# or
pnpm install

# Optional: Set up API key for real data
cp .env.example .env
# Edit .env and add your RAPIDAPI_KEY
```

## API Setup (Optional)

The server works without an API key using mock data. For real data:

1. Sign up at [RapidAPI](https://rapidapi.com/)
2. Subscribe to a [Coursera API](https://rapidapi.com/search/coursera)
3. Copy your API key to `.env`:
   ```
   RAPIDAPI_KEY=your_key_here
   ```

See [API_SETUP_GUIDE.md](../API_SETUP_GUIDE.md) for detailed instructions.

## Current API Integration

**With RAPIDAPI_KEY:**
- Real-time course searches from Coursera
- Actual course details, ratings, and enrollment data
- Live preview video URLs and course links

**Without RAPIDAPI_KEY:**
- Automatically uses mock data
- Features popular courses (Machine Learning, Data Science, Python)
- Perfect for testing and development

## Local Development

### Run the Node.js MCP Server

```bash
npm run dev
```

The server will start on `http://localhost:8000` with these endpoints:
- **SSE Stream**: `GET http://localhost:8000/mcp`
- **Message Post**: `POST http://localhost:8000/mcp/messages?sessionId=...`

### Test with ngrok

To test with ChatGPT locally, expose your server using ngrok:

```bash
# Install ngrok if you haven't
brew install ngrok  # macOS

# Expose your local server
ngrok http 8000
```

You'll get a public URL like `https://xyz789.ngrok-free.app`. Use this in ChatGPT:
- Go to ChatGPT Settings → Connectors
- Add connector: `https://xyz789.ngrok-free.app/mcp`

## Deployment to Cloudflare Workers

### Step 1: Install Wrangler

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

### Step 3: Update wrangler.toml

Edit `wrangler.toml` and update:

```toml
name = "coursera-mcp-server"

[vars]
BASE_URL = "https://coursera-mcp.YOUR-SUBDOMAIN.workers.dev"
```

### Step 4: Add API Key (if using real data)

```bash
wrangler secret put RAPIDAPI_KEY
```

### Step 5: Deploy

```bash
npm run deploy
# or
wrangler deploy
```

After deployment, Wrangler will provide your worker URL:
```
https://coursera-mcp-server.YOUR-SUBDOMAIN.workers.dev
```

### Step 6: Add to ChatGPT

1. Open ChatGPT → Settings → Connectors
2. Click "Add Connector"
3. Enter your Cloudflare Worker URL with `/mcp/rpc` endpoint:
   ```
   https://coursera-mcp-server.YOUR-SUBDOMAIN.workers.dev/mcp/rpc
   ```
4. Save and test!

## Using in ChatGPT

Once connected, you can use natural language to discover courses:

**Example Queries:**

- "I want to learn machine learning"
- "Show me beginner courses on web development"
- "Find data science courses in Spanish"
- "I need intermediate Python programming courses"
- "Show me business management courses"
- "Find courses on artificial intelligence and deep learning"

The assistant will automatically invoke the `play_lecture_video` tool and render the interactive widget with:
- Course cards with thumbnails and ratings
- Video preview players
- Enrollment and duration information
- Skills and difficulty levels
- Direct links to enroll

## Tool Schema

### play_lecture_video

**Input Parameters:**
- `learningGoal` (required) - The learning goal or topic (e.g., "machine learning", "web development")
- `courseQuery` - Specific course search query or keywords
- `difficulty` - Difficulty level (beginner, intermediate, advanced, any)
- `language` - Preferred course language
- `maxResults` - Maximum number of courses to return (1-10)

**Output Widget:** Interactive course cards with:
- Course thumbnails and video previews
- University and instructor information
- Ratings and enrollment counts
- Duration and difficulty levels
- Skills and certificate availability
- Direct enrollment links

## Customization

### Custom API Integration

To use different APIs or the official Coursera Partner API:

1. Get API credentials from [Coursera Partners](https://partners.coursera.org/)

2. Update the `searchCoursesAPI` function in `src/server.ts`:

```typescript
async function searchCoursesAPI(params: any) {
  const response = await fetch('https://api.coursera.org/api/courses.v1', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.COURSERA_API_KEY}`,
    },
    params: new URLSearchParams({
      q: 'search',
      query: params.learningGoal,
      // ... other parameters
    })
  });
  
  return await response.json();
}
```

### Customizing the UI Widget

Edit `ui-components/play-lecture-video.html` to customize:
- Color scheme and branding
- Card layouts and animations
- Video player functionality
- Additional course metadata display

The widget receives data via `window.__WIDGET_PROPS__` and can be fully styled.

## Architecture

### How It Works

1. **ChatGPT** sends a learning goal to the MCP server
2. **MCP Server** searches for relevant courses via API
3. **Tool Handler** processes the request and returns:
   - Course data with videos and details
   - Widget metadata (`_meta.openai/outputTemplate`)
4. **ChatGPT** renders the widget inline using the HTML template
5. **Widget** displays courses with video previews and enrollment links

### MCP Protocol Flow

```
ChatGPT → GET /mcp (SSE connection)
       ← tools/list (play_lecture_video)
       ← resources/list (widget templates)
       
ChatGPT → tools/call (play_lecture_video)
       ← course data + structuredContent + _meta
       
ChatGPT → resources/read (fetch widget HTML)
       ← HTML template
       
ChatGPT renders widget with course data
```

## Troubleshooting

### Server won't start

```bash
# Check if port 8000 is available
lsof -i :8000

# Use a different port
PORT=8001 npm run dev
```

### Widget not rendering in ChatGPT

1. Check that the connector URL is correct
2. Verify CORS headers are set (already configured)
3. Check browser console for errors
4. Ensure `_meta.openai/outputTemplate` matches the resource URI

### No courses found

- Check API key is set correctly
- Verify RapidAPI subscription is active
- Try with mock data (remove API key) to test functionality
- Check console logs for specific API errors

### Cloudflare deployment fails

```bash
# Check your Cloudflare account
wrangler whoami

# Test locally first
wrangler dev
```

## Performance

- **Cloudflare Workers**: ~50ms cold start, ~10ms warm requests
- **Global CDN**: Deploy to 200+ cities worldwide
- **No Database**: Stateless design for maximum scalability
- **Caching**: Consider adding response caching for popular queries

## Security

- **API Key Protection**: Store in environment variables/secrets
- **CORS Enabled**: Allows ChatGPT to connect from any origin
- **Input Validation**: Uses Zod schemas to validate all inputs
- **Sandboxed Widgets**: HTML widgets run in isolated iframes

## License

MIT License - feel free to use this as a template for your own MCP servers!

## Resources

- [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Coursera Partner Program](https://partners.coursera.org/)
- [RapidAPI Coursera APIs](https://rapidapi.com/search/coursera)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ using TypeScript, MCP, and OpenAI Apps SDK

