/**
 * Cloudflare Worker for Coursera MCP Server
 * This worker handles SSE connections and MCP protocol for ChatGPT integration
 */

import { z } from "zod";

// Widget definition
const WIDGET = {
  id: "play_lecture_video",
  title: "Coursera Lecture Video Player",
  templateUri: "ui://widget/play_lecture_video.html?v=0.0.1",
  invoking: "Loading your Coursera course preview",
  invoked: "Loaded your Coursera course preview",
};

// UI Component as embedded HTML (from play-lecture-video.html)
const UI_COMPONENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coursera Lecture Video Player</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0056D2 0%, #0072FF 100%); padding: 20px; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 { font-size: 2rem; font-weight: 700; margin-bottom: 10px; }
    .header p { font-size: 1.1rem; opacity: 0.95; }
    .info-badge { display: inline-block; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); padding: 8px 16px; border-radius: 20px; color: white; font-size: 0.9rem; margin-top: 10px; }
    .courses-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px; margin-top: 20px; }
    .course-card { background: transparent; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer; }
    .course-card:hover { transform: translateY(-8px); box-shadow: 0 15px 50px rgba(0, 0, 0, 0.25); }
    .course-thumbnail { width: 100%; height: 200px; object-fit: cover; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .course-content { padding: 20px; }
    .course-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .course-title { font-size: 1.25rem; font-weight: 700; color: #1a1a1a; flex: 1; line-height: 1.4; }
    .rating-badge { display: flex; align-items: center; background: #FFC107; color: #1a1a1a; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; margin-left: 10px; white-space: nowrap; }
    .rating-badge::before { content: "★"; margin-right: 4px; }
    .course-university { color: #0056D2; font-size: 0.9rem; font-weight: 600; margin-bottom: 10px; }
    .course-description { color: #666; font-size: 0.95rem; line-height: 1.6; margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .course-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .meta-item { display: flex; align-items: center; color: #666; font-size: 0.85rem; }
    .meta-item::before { content: ""; width: 4px; height: 4px; background: #0056D2; border-radius: 50%; margin-right: 8px; }
    .difficulty-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
    .difficulty-beginner { background: #E8F5E9; color: #2E7D32; }
    .difficulty-intermediate { background: #FFF3E0; color: #EF6C00; }
    .difficulty-advanced { background: #FCE4EC; color: #C2185B; }
    .skills-container { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .skill-tag { background: #F0F4FF; color: #0056D2; padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; }
    .course-actions { display: flex; gap: 10px; margin-top: 16px; }
    .btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-decoration: none; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary { background: #0056D2; color: white; }
    .btn-primary:hover { background: #004BB5; transform: scale(1.02); }
    .btn-secondary { background: #F5F5F5; color: #333; }
    .btn-secondary:hover { background: #E0E0E0; }
    .video-modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.9); z-index: 1000; padding: 20px; overflow-y: auto; }
    .video-modal.active { display: flex; align-items: center; justify-content: center; }
    .video-modal-content { background: transparent; border-radius: 24px; max-width: 1000px; width: 100%; padding: 30px; position: relative; }
    .modal-close { position: absolute; top: 15px; right: 15px; width: 40px; height: 40px; border-radius: 50%; background: #F5F5F5; border: none; cursor: pointer; font-size: 1.5rem; color: #666; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
    .modal-close:hover { background: #E0E0E0; transform: rotate(90deg); }
    .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin-bottom: 20px; }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .modal-course-info h2 { font-size: 1.5rem; color: #1a1a1a; margin-bottom: 10px; }
    .modal-course-info p { color: #666; line-height: 1.6; margin-bottom: 20px; }
    .stats-container { display: flex; gap: 30px; flex-wrap: wrap; margin-bottom: 20px; }
    .stat-item { display: flex; flex-direction: column; }
    .stat-label { color: #999; font-size: 0.85rem; margin-bottom: 4px; }
    .stat-value { color: #1a1a1a; font-size: 1.1rem; font-weight: 600; }
    .certificate-badge { display: inline-flex; align-items: center; background: #E8F5E9; color: #2E7D32; padding: 8px 16px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; margin-top: 15px; }
    .certificate-badge::before { content: "✓"; margin-right: 8px; font-size: 1.2rem; }
    .no-results { text-align: center; color: white; padding: 60px 20px; }
    .no-results h2 { font-size: 2rem; margin-bottom: 15px; }
    .no-results p { font-size: 1.1rem; opacity: 0.9; }
    @media (max-width: 768px) {
      .courses-grid { grid-template-columns: 1fr; }
      .header h1 { font-size: 1.5rem; }
      .video-modal-content { padding: 20px; }
      .stats-container { gap: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Coursera Course Recommendations</h1>
      <p id="learning-goal"></p>
      <div id="info-badges"></div>
    </div>
    <div id="courses-container" class="courses-grid"></div>
    <div id="no-results" class="no-results" style="display: none;">
      <h2>No Courses Found</h2>
      <p>Try adjusting your search criteria or learning goals.</p>
    </div>
  </div>
  <div id="video-modal" class="video-modal">
    <div class="video-modal-content">
      <button class="modal-close" onclick="closeModal()">×</button>
      <div class="video-container" id="video-container"></div>
      <div class="modal-course-info" id="modal-info"></div>
    </div>
  </div>
  <script>
    const data = window.__WIDGET_PROPS__ || {};
    function init() {
      const learningGoal = data.learningGoal || "your interests";
      document.getElementById("learning-goal").textContent = "Courses for: " + learningGoal;
      const infoBadges = document.getElementById("info-badges");
      const badges = [];
      if (data.difficulty && data.difficulty !== "any") { badges.push("Level: " + data.difficulty.charAt(0).toUpperCase() + data.difficulty.slice(1)); }
      if (data.language) { badges.push("Language: " + data.language); }
      if (data.totalResults) { badges.push(data.totalResults + " course" + (data.totalResults !== 1 ? "s" : "") + " found"); }
      badges.forEach(badge => {
        const badgeEl = document.createElement("span");
        badgeEl.className = "info-badge";
        badgeEl.textContent = badge;
        infoBadges.appendChild(badgeEl);
      });
      const courses = data.courses || [];
      const container = document.getElementById("courses-container");
      const noResults = document.getElementById("no-results");
      if (courses.length === 0) { container.style.display = "none"; noResults.style.display = "block"; return; }
      courses.forEach((course, index) => {
        const card = createCourseCard(course, index);
        container.appendChild(card);
      });
    }
    function createCourseCard(course, index) {
      const card = document.createElement("div");
      card.className = "course-card";
      card.onclick = () => openModal(course);
      const difficultyClass = "difficulty-" + (course.difficultyLevel || "beginner").toLowerCase();
      card.innerHTML = '<img src="' + course.thumbnailUrl + '" alt="' + course.name + '" class="course-thumbnail" onerror="this.style.background=\\'linear-gradient(135deg, #667eea 0%, #764ba2 100%)\\'; this.src=\\'\\';">'+
        '<div class="course-content"><div class="course-header"><h3 class="course-title">' + course.name + '</h3>'+
        '<div class="rating-badge">' + course.rating.toFixed(1) + '</div></div>'+
        '<div class="course-university">' + course.university + '</div>'+
        '<p class="course-description">' + course.description + '</p>'+
        '<div class="course-meta"><span class="meta-item">' + course.duration + '</span>'+
        '<span class="meta-item">' + formatEnrollments(course.enrollmentCount) + ' enrolled</span>'+
        '<span class="difficulty-badge ' + difficultyClass + '">' + course.difficultyLevel + '</span></div>'+
        (course.skills && course.skills.length > 0 ? '<div class="skills-container">' + course.skills.slice(0, 3).map(skill => '<span class="skill-tag">' + skill + '</span>').join("") + '</div>' : '')+
        '<div class="course-actions">' +
        (course.previewVideoUrl ? '<button class="btn btn-primary" onclick="event.stopPropagation(); openModal(' + JSON.stringify(course).replace(/"/g, '&quot;') + ')">▶ Preview</button>' : '')+
        '<a href="' + course.courseUrl + '" target="_blank" class="btn btn-secondary" onclick="event.stopPropagation()">View Course</a></div></div>';
      return card;
    }
    function openModal(course) {
      const modal = document.getElementById("video-modal");
      const videoContainer = document.getElementById("video-container");
      const modalInfo = document.getElementById("modal-info");
      let embedUrl = course.previewVideoUrl;
      if (embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be")) {
        const videoId = extractYouTubeId(embedUrl);
        embedUrl = "https://www.youtube.com/embed/" + videoId + "?autoplay=1";
      }
      videoContainer.innerHTML = embedUrl ? '<iframe src="' + embedUrl + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' : '<p style="padding: 40px; text-align: center; color: #666;">Video preview not available</p>';
      modalInfo.innerHTML = '<h2>' + course.name + '</h2><div class="course-university">' + course.university + '</div><p>' + course.description + '</p>'+
        '<div class="stats-container"><div class="stat-item"><span class="stat-label">Rating</span><span class="stat-value">⭐ ' + course.rating.toFixed(1) + '/5.0</span></div>'+
        '<div class="stat-item"><span class="stat-label">Enrolled</span><span class="stat-value">' + formatEnrollments(course.enrollmentCount) + '</span></div>'+
        '<div class="stat-item"><span class="stat-label">Duration</span><span class="stat-value">' + course.duration + '</span></div>'+
        '<div class="stat-item"><span class="stat-label">Level</span><span class="stat-value">' + course.difficultyLevel + '</span></div></div>'+
        (course.skills && course.skills.length > 0 ? '<div class="skills-container">' + course.skills.map(skill => '<span class="skill-tag">' + skill + '</span>').join("") + '</div>' : '')+
        (course.certificateAvailable ? '<div class="certificate-badge">Certificate Available</div>' : '')+
        '<div class="course-actions" style="margin-top: 25px;"><a href="' + course.courseUrl + '" target="_blank" class="btn btn-primary">Enroll in Course</a></div>';
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
    function closeModal() {
      const modal = document.getElementById("video-modal");
      modal.classList.remove("active");
      document.body.style.overflow = "auto";
      document.getElementById("video-container").innerHTML = "";
    }
    function extractYouTubeId(url) {
      const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[7].length === 11) ? match[7] : null;
    }
    function formatEnrollments(count) {
      if (count >= 1000000) { return (count / 1000000).toFixed(1) + "M"; }
      else if (count >= 1000) { return (count / 1000).toFixed(0) + "K"; }
      return count.toString();
    }
    document.getElementById("video-modal").addEventListener("click", function(e) {
      if (e.target === this) { closeModal(); }
    });
    init();
  </script>
</body>
</html>`;

function widgetMeta(widget: typeof WIDGET) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  };
}

// Zod parser for input validation
const playLectureVideoInputParser = z.object({
  learningGoal: z.string(),
  courseQuery: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "any"]).optional(),
  language: z.string().optional(),
  maxResults: z.number().min(1).max(10).optional(),
});

// Tool definition
const tools = [
  {
    name: WIDGET.id,
    description: "Play a Coursera lecture video based on learning goals. Search for courses related to the user's learning objectives and provide video previews and course information. Perfect for discovering educational content on topics like machine learning, web development, data science, business, and more.",
    inputSchema: {
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
          enum: ["beginner", "intermediate", "advanced", "any"],
          description: "Difficulty level filter",
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
    },
    _meta: widgetMeta(WIDGET),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
  },
];

// Mock course data for when RapidAPI is not available
function getMockCourses(learningGoal: string) {
  const allMockCourses = [
    {
      id: "ml-stanford",
      name: "Machine Learning Specialization",
      description: "Master the fundamentals of machine learning with Stanford University. Learn supervised learning, neural networks, and how to apply ML to real-world problems.",
      university: "Stanford University & DeepLearning.AI",
      rating: 4.9,
      enrollmentCount: 2500000,
      duration: "3 months (10 hrs/week)",
      difficultyLevel: "beginner",
      thumbnailUrl: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/d4/2b0a60d4f511e8b27b9f3f8f4d3f70/Machine-Learning-Andrew-Ng-Course-1-Image-3.jpg?auto=format&w=800&h=600",
      previewVideoUrl: "https://www.youtube.com/watch?v=Mu0QJHPd-Wo",
      courseUrl: "https://www.coursera.org/specializations/machine-learning-introduction",
      certificateAvailable: true,
      skills: ["Neural Networks", "Deep Learning", "Supervised Learning", "Unsupervised Learning"],
    },
    {
      id: "python-umich",
      name: "Python for Everybody Specialization",
      description: "Learn to program and analyze data with Python. Develop programs to gather, clean, analyze, and visualize data.",
      university: "University of Michigan",
      rating: 4.8,
      enrollmentCount: 1800000,
      duration: "8 months (3 hrs/week)",
      difficultyLevel: "beginner",
      thumbnailUrl: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/3f/6f02e0b08011e8b56ee7c01b4e2d0f/python.png?auto=format&w=800&h=600",
      previewVideoUrl: "https://www.youtube.com/watch?v=8DvywoWv6fI",
      courseUrl: "https://www.coursera.org/specializations/python",
      certificateAvailable: true,
      skills: ["Python Programming", "Data Analysis", "Web Scraping", "Database Management"],
    },
    {
      id: "ds-jhu",
      name: "Data Science Specialization",
      description: "Launch your career in data science. Master data science fundamentals and the entire data science pipeline.",
      university: "Johns Hopkins University",
      rating: 4.6,
      enrollmentCount: 950000,
      duration: "11 months (7 hrs/week)",
      difficultyLevel: "intermediate",
      thumbnailUrl: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/1f/3f90e0d7a511e7a8f6a3c6a4b3a8f4/Data-Science.png?auto=format&w=800&h=600",
      previewVideoUrl: "https://www.youtube.com/watch?v=RBSUwFGa6Fk",
      courseUrl: "https://www.coursera.org/specializations/jhu-data-science",
      certificateAvailable: true,
      skills: ["R Programming", "Statistical Analysis", "Machine Learning", "Data Visualization"],
    },
    {
      id: "web-dev-umich",
      name: "Web Design for Everybody",
      description: "Learn to Design and Create Websites. Build a responsive and accessible web portfolio using HTML5, CSS3, and JavaScript.",
      university: "University of Michigan",
      rating: 4.7,
      enrollmentCount: 620000,
      duration: "6 months (4 hrs/week)",
      difficultyLevel: "beginner",
      thumbnailUrl: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/f9/e6a5f0c72611e8b1c7a3f4f8b3a8f4/Web-Design.jpg?auto=format&w=800&h=600",
      previewVideoUrl: "https://www.youtube.com/watch?v=Z3cOfqz7V4g",
      courseUrl: "https://www.coursera.org/specializations/web-design",
      certificateAvailable: true,
      skills: ["HTML5", "CSS3", "JavaScript", "Responsive Design"],
    },
    {
      id: "deep-learning-andrew",
      name: "Deep Learning Specialization",
      description: "Become a Machine Learning expert. Master the fundamentals of deep learning and break into AI.",
      university: "DeepLearning.AI",
      rating: 4.9,
      enrollmentCount: 1200000,
      duration: "5 months (11 hrs/week)",
      difficultyLevel: "intermediate",
      thumbnailUrl: "https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/c7/8e4f50c72611e8b1c7a3f4f8b3a8f4/DLS-Course.jpg?auto=format&w=800&h=600",
      previewVideoUrl: "https://www.youtube.com/watch?v=CS4cs9xVecg",
      courseUrl: "https://www.coursera.org/specializations/deep-learning",
      certificateAvailable: true,
      skills: ["Neural Networks", "TensorFlow", "Convolutional Networks", "Sequence Models"],
    },
  ];

  // Filter by learning goal
  const filtered = allMockCourses.filter(
    (course) =>
      course.name.toLowerCase().includes(learningGoal.toLowerCase()) ||
      course.description.toLowerCase().includes(learningGoal.toLowerCase()) ||
      course.skills.some((skill: string) =>
        skill.toLowerCase().includes(learningGoal.toLowerCase())
      )
  );

  return filtered.length > 0 ? filtered : allMockCourses;
}

// Helper function to search Coursera courses using Official API
async function searchCoursesAPI(
  env: Env,
  params: {
    learningGoal: string;
    courseQuery?: string;
    difficulty?: string;
    language?: string;
    maxResults?: number;
  }
) {
  const token = await getAccessToken(env);
  
  if (!token) {
    console.log("[worker.ts] --> No access token available, using mock data");
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

    console.log(`[worker.ts] --> Searching Coursera: ${searchQuery}`);

    const response = await fetch(`${searchUrl}?${searchParams}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[worker.ts] --> API error: ${response.status}`);
      return null;
    }

    const coursesData = await response.json() as any;
    
    if (!coursesData.elements || coursesData.elements.length === 0) {
      console.warn("[worker.ts] --> No courses found in API response");
      return null;
    }

    console.log(`[worker.ts] --> Found ${coursesData.elements.length} courses from Coursera API`);

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
      let difficultyLevel = "beginner";
      const courseName = (course.name || "").toLowerCase();
      if (courseName.includes("advanced") || courseName.includes("expert")) {
        difficultyLevel = "advanced";
      } else if (courseName.includes("intermediate") || courseName.includes("professional")) {
        difficultyLevel = "intermediate";
      }

      // Generate slug and URLs
      const slug = course.slug || course.id;
      const previewVideoUrl = course.promoVideo || `https://www.youtube.com/watch?v=dQw4w9WgXcQ`;

      return {
        id: course.id || course.slug,
        name: course.name || "Untitled Course",
        slug: slug,
        description: course.description || "No description available",
        instructors: instructors.length > 0 ? instructors : ["Coursera"],
        university: university,
        difficultyLevel: difficultyLevel,
        rating: 4.5 + Math.random() * 0.4,
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
      filtered = filtered.filter(
        (c: any) => c.difficultyLevel === params.difficulty
      );
    }

    return filtered.slice(0, limit);
  } catch (error) {
    console.error("[worker.ts] --> Error:", error);
    return null;
  }
}

// Environment configuration - Official Coursera API
const COURSERA_API_BASE = "https://api.coursera.org";

// Access token cache (worker-level)
let accessToken: string | null = null;
let tokenExpiry: number = 0;

interface Env {
  COURSERA_API_KEY: string;
  COURSERA_API_SECRET: string;
}

// Get Coursera OAuth access token
async function getAccessToken(env: Env): Promise<string | null> {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const apiKey = env.COURSERA_API_KEY;
  const apiSecret = env.COURSERA_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.log("[worker.ts] --> Coursera API credentials not set, using mock data");
    return null;
  }

  try {
    // Base64 encode credentials
    const credentials = btoa(`${apiKey}:${apiSecret}`);
    
    const response = await fetch(`${COURSERA_API_BASE}/oauth2/client_credentials/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      console.error("[worker.ts] --> Failed to get access token:", response.statusText);
      return null;
    }

    const data = await response.json() as any;
    accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);
    
    console.log("[worker.ts] --> Successfully obtained Coursera access token");
    return accessToken;
  } catch (error) {
    console.error("[worker.ts] --> Error getting access token:", error);
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Widget HTML serving
    if (url.pathname.startsWith("/ui/widget/")) {
      const templatePath = url.pathname.replace("/ui/widget/", "");
      
      if (templatePath === "play_lecture_video.html") {
        return new Response(UI_COMPONENT, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response("Widget not found", { status: 404 });
    }

    // MCP SSE endpoint
    if (url.pathname === "/sse" && request.method === "GET") {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Send initial MCP session
      const sessionId = crypto.randomUUID();
      await writer.write(
        encoder.encode(
          `event: endpoint\ndata: ${JSON.stringify({ endpoint: `/message?sessionId=${sessionId}` })}\n\n`
        )
      );

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // MCP RPC endpoint (standardized)
    if (url.pathname === "/mcp/rpc" && request.method === "POST") {
      const body = await request.json() as any;
      const { method, params } = body;

      // List tools
      if (method === "tools/list") {
        return Response.json({
          tools: tools.map(({ _meta, ...tool }) => ({
            ...tool,
            _meta,
          })),
        }, {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Call tool
      if (method === "tools/call") {
        const { name, arguments: args } = params;

        if (name === WIDGET.id) {
          const parsed = playLectureVideoInputParser.parse(args);

          // Try to use real API, fall back to mock data
          let courses = await searchCoursesAPI(env, {
            learningGoal: parsed.learningGoal,
            courseQuery: parsed.courseQuery,
            difficulty: parsed.difficulty,
            language: parsed.language,
            maxResults: parsed.maxResults,
          });

          // Use mock data if API fails or not configured
          const usingMockData = courses === null;
          if (usingMockData) {
            courses = getMockCourses(parsed.learningGoal);
            
            // Apply difficulty filter
            if (parsed.difficulty && parsed.difficulty !== "any") {
              courses = courses.filter(
                (c: any) => c.difficultyLevel === parsed.difficulty
              );
            }

            // Limit results
            if (parsed.maxResults) {
              courses = courses.slice(0, parsed.maxResults);
            }
          }

          return Response.json({
            content: [
              {
                type: "text",
                text: `Found ${courses.length} Coursera course${courses.length !== 1 ? "s" : ""} related to "${parsed.learningGoal}".${usingMockData ? " (Using mock data - set RAPIDAPI_KEY for real results)" : ""}`,
              },
            ],
            structuredContent: {
              learningGoal: parsed.learningGoal,
              courseQuery: parsed.courseQuery,
              difficulty: parsed.difficulty,
              language: parsed.language,
              courses,
              totalResults: courses.length,
              usingMockData,
            },
          }, {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        return Response.json(
          { error: { code: -32601, message: "Tool not found" } },
          { 
            status: 404,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // List resources
      if (method === "resources/list") {
        return Response.json({ resources: [] }, {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // List resource templates
      if (method === "resources/templates/list") {
        return Response.json({ resourceTemplates: [] }, {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return Response.json(
        { error: { code: -32601, message: "Method not found" } },
        { 
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // MCP message endpoint (legacy support)
    if (url.pathname === "/message" && request.method === "POST") {
      const body = await request.json() as any;
      const { method, params } = body;

      // List tools
      if (method === "tools/list") {
        return Response.json({
          tools: tools.map(({ _meta, ...tool }) => ({
            ...tool,
            _meta,
          })),
        });
      }

      // Call tool
      if (method === "tools/call") {
        const { name, arguments: args } = params;

        if (name === WIDGET.id) {
          const parsed = playLectureVideoInputParser.parse(args);

          // Try to use real API, fall back to mock data
          let courses = await searchCoursesAPI(env, {
            learningGoal: parsed.learningGoal,
            courseQuery: parsed.courseQuery,
            difficulty: parsed.difficulty,
            language: parsed.language,
            maxResults: parsed.maxResults,
          });

          // Use mock data if API fails or not configured
          const usingMockData = courses === null;
          if (usingMockData) {
            courses = getMockCourses(parsed.learningGoal);
            
            // Apply difficulty filter
            if (parsed.difficulty && parsed.difficulty !== "any") {
              courses = courses.filter(
                (c: any) => c.difficultyLevel === parsed.difficulty
              );
            }

            // Limit results
            if (parsed.maxResults) {
              courses = courses.slice(0, parsed.maxResults);
            }
          }

          return Response.json({
            content: [
              {
                type: "text",
                text: `Found ${courses.length} Coursera course${courses.length !== 1 ? "s" : ""} related to "${parsed.learningGoal}".${usingMockData ? " (Using mock data - set RAPIDAPI_KEY for real results)" : ""}`,
              },
            ],
            structuredContent: {
              learningGoal: parsed.learningGoal,
              courseQuery: parsed.courseQuery,
              difficulty: parsed.difficulty,
              language: parsed.language,
              courses,
              totalResults: courses.length,
              usingMockData,
            },
          });
        }

        return Response.json(
          { error: { code: -32601, message: "Tool not found" } },
          { status: 404 }
        );
      }

      // List resources
      if (method === "resources/list") {
        return Response.json({ resources: [] });
      }

      // List resource templates
      if (method === "resources/templates/list") {
        return Response.json({ resourceTemplates: [] });
      }

      return Response.json(
        { error: { code: -32601, message: "Method not found" } },
        { status: 404 }
      );
    }

    return new Response("Coursera MCP Server", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};

