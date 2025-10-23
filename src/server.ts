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

// Environment configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = "coursera-api.p.rapidapi.com";

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
const ROOT_DIR = path.resolve(__dirname, "..");
const UI_COMPONENTS_DIR = path.resolve(ROOT_DIR, "ui-components");

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(UI_COMPONENTS_DIR)) {
    console.warn(`Widget components directory not found at ${UI_COMPONENTS_DIR}`);
    return `<!DOCTYPE html><html><body><div id="root">Widget: ${componentName}</div></body></html>`;
  }

  const htmlPath = path.join(UI_COMPONENTS_DIR, `${componentName}.html`);
  
  if (fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, "utf8");
  } else {
    console.warn(`Widget HTML for "${componentName}" not found`);
    return `<!DOCTYPE html><html><body><div id="root">Widget: ${componentName}</div></body></html>`;
  }
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

// Helper function to search Coursera courses using RapidAPI
async function searchCoursesAPI(params: {
  learningGoal: string;
  courseQuery?: string;
  difficulty?: string;
  language?: string;
  maxResults?: number;
}) {
  if (!RAPIDAPI_KEY) {
    console.warn("[server.ts][145] --> RAPIDAPI_KEY not set, using mock data");
    return null;
  }

  try {
    const searchQuery = params.courseQuery || params.learningGoal;
    const searchUrl = `https://${RAPIDAPI_HOST}/courses/search`;
    const searchParams = new URLSearchParams({
      query: searchQuery,
      limit: String(params.maxResults || 5),
    });

    if (params.language) {
      searchParams.append("language", params.language);
    }

    const response = await fetch(`${searchUrl}?${searchParams}`, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      console.error("[server.ts][169] --> Failed to search courses:", response.statusText);
      return null;
    }

    const coursesData = await response.json();
    
    // Transform API response to our format
    const courses = (coursesData.courses || coursesData.elements || [])
      .slice(0, params.maxResults || 5)
      .map((course: any) => ({
        id: course.id || course.slug,
        name: course.name || course.title,
        slug: course.slug,
        description: course.description || course.subtitle || "No description available",
        instructors: course.instructors || course.partners?.map((p: any) => p.name) || ["Coursera"],
        university: course.partners?.[0]?.name || course.university || "Coursera",
        difficultyLevel: course.difficultyLevel || course.level || "Beginner",
        rating: course.avgLearningObjectRating || course.rating || 4.5,
        enrollmentCount: course.enrollmentCount || course.enrollments || 10000,
        thumbnailUrl: course.photoUrl || course.imageUrl || "https://via.placeholder.com/400x300",
        previewVideoUrl: course.promoVideo?.sources?.[0]?.url || extractVideoUrl(course),
        duration: course.workload || "4 weeks",
        language: course.language || params.language || "English",
        skills: course.skills || course.domainTypes || [],
        certificateAvailable: course.certificates?.length > 0 || true,
        courseUrl: `https://www.coursera.org/learn/${course.slug}`,
      }));

    // Filter by difficulty if specified
    let filtered = courses;
    if (params.difficulty && params.difficulty !== "any") {
      filtered = filtered.filter((c: any) => 
        c.difficultyLevel.toLowerCase().includes(params.difficulty!.toLowerCase())
      );
    }

    return filtered;
  } catch (error) {
    console.error("[server.ts][213] --> Error searching courses:", error);
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
          console.warn("[server.ts][344] --> Using mock course data");
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
            courses = courses.filter((c) => 
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
              text: `Found ${courses.length} Coursera course${courses.length !== 1 ? "s" : ""} related to "${args.learningGoal}".${!RAPIDAPI_KEY ? " (Using mock data - set RAPIDAPI_KEY for real results)" : ""}`,
            },
          ],
          structuredContent: {
            learningGoal: args.learningGoal,
            courseQuery: args.courseQuery,
            difficulty: args.difficulty,
            language: args.language,
            courses: courses,
            totalResults: courses.length,
            usingMockData: !RAPIDAPI_KEY,
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

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
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

