import React from 'react';
import { useWidgetProps } from '../hooks';
import '../styles/index.css';

interface Course {
  id: string;
  name: string;
  university: string;
  description: string;
  thumbnailUrl?: string;
  rating: number;
  duration: string;
  enrollmentCount: number;
  difficultyLevel: string;
  skills?: string[];
  previewVideoUrl?: string;
  courseUrl: string;
  certificateAvailable?: boolean;
}

interface Props extends Record<string, unknown> {
  learningGoal?: string;
  difficulty?: string;
  language?: string;
  totalResults?: number;
  courses?: Course[];
}

const CourseraCourses: React.FC<Partial<Props>> = (externalProps) => {
  const props = useWidgetProps<Props>({
    learningGoal: 'your interests',
    difficulty: 'any',
    language: '',
    totalResults: 0,
    courses: []
  });

  // Merge external props (for preview mode) with widget props
  const finalProps = { ...props, ...externalProps };
  const { learningGoal, courses = [] } = finalProps;

  // Debug logging
  console.log('CourseraCourses render:', { 
    learningGoal, 
    coursesCount: courses.length,
    firstCourse: courses[0]?.name,
    firstVideoUrl: courses[0]?.previewVideoUrl
  });

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const getEmbedUrl = (url: string): string => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = extractYouTubeId(url);
      const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
      console.log('Video embed URL:', embedUrl, 'from:', url);
      return embedUrl;
    }
    return url;
  };

  // Get the first course with a video
  const course = courses.find(c => c.previewVideoUrl) || courses[0];

  if (!course || !course.previewVideoUrl) {
    return (
      <div className="w-full">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Course Video Available</h2>
          <p className="text-gray-600">Loading course content for: {learningGoal}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl bg-black">
      <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
        <iframe
          src={getEmbedUrl(course.previewVideoUrl)}
          className="absolute top-0 left-0 w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={course.name}
        />
      </div>
      
      {/* Course Info Overlay - Bottom Left */}
      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-4 mb-3">
          {course.university && (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
                </svg>
              </div>
              <span className="text-white text-sm font-medium">{course.university}</span>
            </div>
          )}
        </div>
        <h1 className="text-white text-3xl font-bold mb-2 drop-shadow-lg">
          {course.name}
        </h1>
      </div>

      {/* Coursera Logo - Top Right */}
      <div className="absolute top-6 right-6">
        <div className="bg-blue-600 px-5 py-2.5 rounded-2xl shadow-lg">
          <span className="text-white font-bold text-lg tracking-wide">coursera</span>
        </div>
      </div>
    </div>
  );
};

export default CourseraCourses;








