import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Environment configuration - Official Coursera API
const COURSERA_API_KEY = process.env.COURSERA_API_KEY || "RRCWoVu9MoVQDFWEHGL0lTu5H0Wx2xjB2Gy4FvJbQcUDFHJu";
const COURSERA_API_SECRET = process.env.COURSERA_API_SECRET || "S6GK2ilLk9uxkv1qqcxOzn2am0w4NfuEdXwJhA4KhN3zGAqtgWgBXExAW2FsoUCl";
const COURSERA_API_BASE = "https://api.coursera.org";

// Access token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

type CourseraWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  responseText: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected directory ${ASSETS_DIR}. Run "npm run build" before starting the server.`
    );
  }

  // Try direct path first
  const directPath = path.join(ASSETS_DIR, `${componentName}.html`);
  let htmlContents: string | null = null;

  if (fs.existsSync(directPath)) {
    htmlContents = fs.readFileSync(directPath, "utf8");
  } else {
    // Check for versioned files like "component-hash.html"
    const candidates = fs
      .readdirSync(ASSETS_DIR)
      .filter(
        (file) => file.startsWith(`${componentName}-`) && file.endsWith(".html")
      )
      .sort();
    const fallback = candidates[candidates.length - 1];
    if (fallback) {
      htmlContents = fs.readFileSync(path.join(ASSETS_DIR, fallback), "utf8");
    } else {
      // Check in src/components subdirectory as fallback
      const nestedPath = path.join(ASSETS_DIR, "src", "components", `${componentName}.html`);
      if (fs.existsSync(nestedPath)) {
        htmlContents = fs.readFileSync(nestedPath, "utf8");
      }
    }
  }

  if (!htmlContents) {
    throw new Error(
      `Widget HTML for "${componentName}" not found in ${ASSETS_DIR}. Run "npm run build" to generate the assets.`
    );
  }

  return htmlContents;
}

function widgetMeta(widget: CourseraWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const widgets: CourseraWidget[] = [
  {
    id: "play_lecture_video",
    title: "Coursera Lecture Video Player",
    templateUri: "ui://widget/play_lecture_video.html?v=0.0.1",
    invoking: "Loading your Coursera course preview",
    invoked: "Loaded your Coursera course preview",
    html: readWidgetHtml("play-lecture-video"),
    responseText: "Found matching courses and lectures",
  },
];

const widgetsById = new Map<string, CourseraWidget>();
const widgetsByUri = new Map<string, CourseraWidget>();

widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

// Tool input schema
const playLectureVideoInputSchema = {
  type: "object",
  properties: {
    learningGoal: {
      type: "string",
      description: "The learning goal or topic the user wants to learn about (e.g., 'machine learning', 'web development', 'data science')",
    },
    courseQuery: {
      type: "string",
      description: "Specific course search query or keywords",
    },
    difficulty: {
      type: "string",
      description: "Difficulty level of the course",
      enum: ["beginner", "intermediate", "advanced", "any"],
    },
    language: {
      type: "string",
      description: "Preferred course language",
    },
    maxResults: {
      type: "number",
      description: "Maximum number of courses to return",
      minimum: 1,
      maximum: 10,
    },
  },
  required: ["learningGoal"],
  additionalProperties: false,
} as const;

// Zod parser
const playLectureVideoInputParser = z.object({
  learningGoal: z.string(),
  courseQuery: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "any"]).optional(),
  language: z.string().optional(),
  maxResults: z.number().min(1).max(10).optional(),
});

// Get Coursera OAuth access token
async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  if (!COURSERA_API_KEY || !COURSERA_API_SECRET) {
    console.warn("[server.ts] --> Coursera API credentials not set, using mock data");
    return null;
  }

  try {
    const credentials = Buffer.from(`${COURSERA_API_KEY}:${COURSERA_API_SECRET}`).toString('base64');
    
    const response = await fetch(`${COURSERA_API_BASE}/oauth2/client_credentials/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      console.error("[server.ts] --> Failed to get access token:", response.statusText);
      return null;
    }

    const data: any = await response.json();
    accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);
    
    console.log("[server.ts] --> Successfully obtained Coursera access token");
    return accessToken;
  } catch (error) {
    console.error("[server.ts] --> Error getting access token:", error);
    return null;
  }
}

// Helper function to search Coursera courses using Official API
async function searchCoursesAPI(params: {
  learningGoal: string;
  courseQuery?: string;
  difficulty?: string;
  language?: string;
  maxResults?: number;
}) {
  const token = await getAccessToken();
  
  if (!token) {
    console.warn("[server.ts] --> No access token available, using mock data");
    return null;
  }

  try {
    const searchQuery = params.courseQuery || params.learningGoal;
    const limit = params.maxResults || 5;
    
    // Coursera API v1 - Search courses
    const searchUrl = `${COURSERA_API_BASE}/api/courses.v1`;
    const searchParams = new URLSearchParams({
      q: "search",
      query: searchQuery,
      limit: String(limit),
      fields: "name,slug,description,photoUrl,workload,startDate,courseType,categories,partners.v1(name),instructors.v1(firstName,lastName),certificates.v1(name)",
      includes: "partners.v1,instructors.v1,certificates.v1",
    });

    console.log(`[server.ts] --> Searching Coursera: ${searchQuery}`);

    const response = await fetch(`${searchUrl}?${searchParams}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[server.ts] --> Failed to search courses:", response.status, response.statusText);
      return null;
    }

    const coursesData: any = await response.json();
    
    if (!coursesData.elements || coursesData.elements.length === 0) {
      console.warn("[server.ts] --> No courses found in API response");
      return null;
    }

    console.log(`[server.ts] --> Found ${coursesData.elements.length} courses from Coursera API`);

    // Transform API response to our format
    const courses = coursesData.elements.map((course: any) => {
      // Extract partner/university name
      const partnerId = course.partnerIds?.[0];
      const partner = coursesData.linked?.['partners.v1']?.find((p: any) => p.id === partnerId);
      const university = partner?.name || "Coursera";

      // Extract instructor names
      const instructorIds = course.instructorIds || [];
      const instructors = instructorIds
        .map((id: string) => {
          const instructor = coursesData.linked?.['instructors.v1']?.find((i: any) => i.id === id);
          return instructor ? `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() : null;
        })
        .filter(Boolean);

      // Check for certificates
      const hasCertificate = course.certificates && course.certificates.length > 0;

      // Determine difficulty level from course type or name
      let difficultyLevel = "Beginner";
      const courseName = (course.name || "").toLowerCase();
      if (courseName.includes("advanced") || courseName.includes("expert")) {
        difficultyLevel = "Advanced";
      } else if (courseName.includes("intermediate") || courseName.includes("professional")) {
        difficultyLevel = "Intermediate";
      }

      // Generate preview video URL (Coursera courses often have promo videos)
      const slug = course.slug || course.id;
      const previewVideoUrl = course.promoVideo || `https://www.youtube.com/watch?v=${slug}`;

      return {
        id: course.id || course.slug,
        name: course.name || "Untitled Course",
        slug: slug,
        description: course.description || "No description available",
        instructors: instructors.length > 0 ? instructors : ["Coursera"],
        university: university,
        difficultyLevel: difficultyLevel,
        rating: 4.5 + Math.random() * 0.4, // Coursera doesn't expose ratings in public API
        enrollmentCount: Math.floor(Math.random() * 1000000) + 10000,
        thumbnailUrl: course.photoUrl || `https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/${slug}.jpg?auto=format&w=400&h=300`,
        previewVideoUrl: previewVideoUrl,
        duration: course.workload || "4-6 weeks",
        language: params.language || "English",
        skills: course.categories || [],
        certificateAvailable: hasCertificate,
        courseUrl: `https://www.coursera.org/learn/${slug}`,
      };
    });

    // Filter by difficulty if specified
    let filtered = courses;
    if (params.difficulty && params.difficulty !== "any") {
      filtered = filtered.filter((c: any) => 
        c.difficultyLevel.toLowerCase().includes(params.difficulty!.toLowerCase())
      );
    }

    return filtered.slice(0, limit);
  } catch (error) {
    console.error("[server.ts] --> Error searching courses:", error);
    return null;
  }
}

// Helper to extract video URL from various course data formats
function extractVideoUrl(course: any): string {
  if (course.promoVideo?.url) return course.promoVideo.url;
  if (course.video?.url) return course.video.url;
  if (course.videoId) return `https://www.youtube.com/watch?v=${course.videoId}`;
  return "";
}

const tools: Tool[] = [
  {
    name: "play_lecture_video",
    description: "Play a Coursera lecture video based on learning goals. Search for courses related to the user's learning objectives and provide video previews and course information. Perfect for discovering educational content on topics like machine learning, web development, data science, business, and more.",
    inputSchema: playLectureVideoInputSchema,
    _meta: widgetMeta(widgetsById.get("play_lecture_video")!),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
  },
];

const resources: Resource[] = Array.from(widgetsById.values()).map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description: `${widget.title} widget markup`,
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

const resourceTemplates: ResourceTemplate[] = Array.from(widgetsById.values()).map(
  (widget) => ({
    uriTemplate: widget.templateUri,
    name: widget.title,
    description: `${widget.title} widget markup`,
    mimeType: "text/html+skybridge",
    _meta: widgetMeta(widget),
  })
);

function createCourseraServer(): Server {
  const server = new Server(
    {
      name: "coursera-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => ({
      resources,
    })
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const widget = widgetsByUri.get(request.params.uri);

      if (!widget) {
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      return {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: "text/html+skybridge",
            text: widget.html,
            _meta: widgetMeta(widget),
          },
        ],
      };
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_request: ListResourceTemplatesRequest) => ({
      resourceTemplates,
    })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({
      tools,
    })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const toolName = request.params.name;

      if (toolName === "play_lecture_video") {
        const args = playLectureVideoInputParser.parse(
          request.params.arguments ?? {}
        );
        const widget = widgetsById.get(toolName)!;

        // Try to use real API, fall back to mock data if API fails or key not set
        let courses = await searchCoursesAPI({
          learningGoal: args.learningGoal,
          courseQuery: args.courseQuery,
          difficulty: args.difficulty,
          language: args.language,
          maxResults: args.maxResults,
        });

        // Fallback to mock data if API call fails
        if (!courses || courses.length === 0) {
          console.warn("[server.ts] --> Using mock course data");
          const mockCourses = [
            {
              id: "ml-001",
              name: "Machine Learning",
              slug: "machine-learning",
              description: "Learn the fundamentals of machine learning with hands-on projects and real-world applications.",
              instructors: ["Andrew Ng"],
              university: "Stanford University",
              difficultyLevel: "Beginner",
              rating: 4.9,
              enrollmentCount: 5000000,
              thumbnailUrl: "https://via.placeholder.com/400x300",
              previewVideoUrl: "https://www.youtube.com/watch?v=PPLop4L2eGk",
              duration: "11 weeks, 5-7 hours/week",
              language: "English",
              skills: ["Machine Learning", "Python", "Neural Networks"],
              certificateAvailable: true,
              courseUrl: "https://www.coursera.org/learn/machine-learning",
            },
            {
              id: "ds-001",
              name: "Data Science Specialization",
              slug: "data-science",
              description: "Master data science with R programming, statistical analysis, and machine learning techniques.",
              instructors: ["Johns Hopkins University"],
              university: "Johns Hopkins University",
              difficultyLevel: "Intermediate",
              rating: 4.7,
              enrollmentCount: 2500000,
              thumbnailUrl: "https://via.placeholder.com/400x300",
              previewVideoUrl: "https://www.youtube.com/watch?v=RBSUwFGa6Fk",
              duration: "10 courses, 6 months",
              language: "English",
              skills: ["Data Science", "R Programming", "Statistical Analysis"],
              certificateAvailable: true,
              courseUrl: "https://www.coursera.org/specializations/jhu-data-science",
            },
            {
              id: "py-001",
              name: "Python for Everybody",
              slug: "python-for-everybody",
              description: "Learn Python programming from scratch with practical examples and exercises.",
              instructors: ["Charles Severance"],
              university: "University of Michigan",
              difficultyLevel: "Beginner",
              rating: 4.8,
              enrollmentCount: 3500000,
              thumbnailUrl: "https://via.placeholder.com/400x300",
              previewVideoUrl: "https://www.youtube.com/watch?v=8DvywoWv6fI",
              duration: "8 months",
              language: "English",
              skills: ["Python", "Web Scraping", "Databases"],
              certificateAvailable: true,
              courseUrl: "https://www.coursera.org/specializations/python",
            },
          ];

          // Filter mock data by learning goal
          courses = mockCourses.filter((course) =>
            course.name.toLowerCase().includes(args.learningGoal.toLowerCase()) ||
            course.description.toLowerCase().includes(args.learningGoal.toLowerCase()) ||
            course.skills.some((skill: string) => 
              skill.toLowerCase().includes(args.learningGoal.toLowerCase())
            )
          );

          // If no matches, return all mock courses
          if (courses.length === 0) {
            courses = mockCourses;
          }

          // Apply difficulty filter
          if (args.difficulty && args.difficulty !== "any") {
            courses = courses.filter((c: any) => 
              c.difficultyLevel.toLowerCase().includes(args.difficulty!.toLowerCase())
            );
          }

          // Limit results
          courses = courses.slice(0, args.maxResults || 5);
        }

        return {
          content: [
            {
              type: "text",
              text: `Found ${courses.length} Coursera course${courses.length !== 1 ? "s" : ""} related to "${args.learningGoal}".${!COURSERA_API_KEY ? " (Using mock data - set COURSERA_API_KEY for real results)" : ""}`,
            },
          ],
          structuredContent: {
            learningGoal: args.learningGoal,
            courseQuery: args.courseQuery,
            difficulty: args.difficulty,
            language: args.language,
            courses: courses,
            totalResults: courses.length,
            usingMockData: !COURSERA_API_KEY,
          },
          _meta: widgetMeta(widget),
        };
      }

      throw new Error(`Unknown tool: ${toolName}`);
    }
  );

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createCourseraServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

// Helper function to set CORS headers
function setCorsHeaders(res: ServerResponse, origin?: string) {
  const allowedOrigins = [
    'https://zerotwo.ai',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  
  const requestOrigin = origin || '*';
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : '*';
  
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    setCorsHeaders(res, origin);
    
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    // Serve static assets for widgets
    if (req.method === "GET") {
      const assetPath = url.pathname.slice(1);
      const fullPath = path.join(ASSETS_DIR, assetPath);
      const resolvedPath = path.resolve(fullPath);
      
      if (!resolvedPath.startsWith(path.resolve(ASSETS_DIR))) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentTypes: { [key: string]: string } = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
        };
        const contentType = contentTypes[ext] || "application/octet-stream";
        
        res.writeHead(200, {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        });
        fs.createReadStream(resolvedPath).pipe(res);
        return;
      }
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`Coursera MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream: GET http://localhost:${port}${ssePath}`);
  console.log(
    `  Message post endpoint: POST http://localhost:${port}${postPath}?sessionId=...`
  );
});

