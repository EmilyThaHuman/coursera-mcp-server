import { useOpenAiGlobal } from "./use-openai-global";

export function useWidgetProps<T extends Record<string, unknown>>(
  defaultState?: T | (() => T)
): T {
  // Mock data for coursera widgets
  const mockData = {
    learningGoal: 'Machine Learning and AI',
    difficulty: 'intermediate',
    language: 'English',
    totalResults: 1234,
    courses: [
      {
        id: '1',
        name: 'Machine Learning Specialization',
        university: 'Stanford University',
        description: 'Master fundamental AI concepts and gain practical machine learning skills in the beginner-friendly, 3-course program by AI visionary Andrew Ng.',
        thumbnailUrl: 'https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/ml-specialization.jpg',
        rating: 4.9,
        duration: '3 months',
        enrollmentCount: 2500000,
        difficultyLevel: 'Beginner',
        skills: ['Python', 'Machine Learning', 'Neural Networks', 'Deep Learning'],
        previewVideoUrl: 'https://www.youtube.com/watch?v=example1',
        courseUrl: 'https://www.coursera.org/specializations/machine-learning',
        certificateAvailable: true,
      },
      {
        id: '2',
        name: 'Deep Learning Specialization',
        university: 'DeepLearning.AI',
        description: 'If you want to break into AI, this Specialization will help you do so. Deep Learning is one of the most highly sought after skills in tech.',
        thumbnailUrl: 'https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/deep-learning.jpg',
        rating: 4.8,
        duration: '5 months',
        enrollmentCount: 1800000,
        difficultyLevel: 'Intermediate',
        skills: ['TensorFlow', 'Convolutional Networks', 'RNNs', 'NLP'],
        previewVideoUrl: 'https://www.youtube.com/watch?v=example2',
        courseUrl: 'https://www.coursera.org/specializations/deep-learning',
        certificateAvailable: true,
      },
      {
        id: '3',
        name: 'AI For Everyone',
        university: 'DeepLearning.AI',
        description: 'AI is not only for engineers. This course is designed for non-technical professionals looking to understand AI and how to apply it in their careers.',
        thumbnailUrl: 'https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/ai-for-everyone.jpg',
        rating: 4.7,
        duration: '1 month',
        enrollmentCount: 950000,
        difficultyLevel: 'Beginner',
        skills: ['AI Strategy', 'AI Projects', 'Business Applications'],
        previewVideoUrl: 'https://www.youtube.com/watch?v=example3',
        courseUrl: 'https://www.coursera.org/learn/ai-for-everyone',
        certificateAvailable: true,
      },
      {
        id: '4',
        name: 'Natural Language Processing Specialization',
        university: 'DeepLearning.AI',
        description: 'Learn cutting-edge natural language processing techniques to process speech and analyze text. Build probabilistic and deep learning models.',
        thumbnailUrl: 'https://d3njjcbhbojbot.cloudfront.net/api/utilities/v1/imageproxy/https://coursera-course-photos.s3.amazonaws.com/nlp.jpg',
        rating: 4.6,
        duration: '4 months',
        enrollmentCount: 425000,
        difficultyLevel: 'Advanced',
        skills: ['NLP', 'Transformers', 'BERT', 'Attention Models'],
        previewVideoUrl: 'https://www.youtube.com/watch?v=example4',
        courseUrl: 'https://www.coursera.org/specializations/natural-language-processing',
        certificateAvailable: true,
      },
    ],
  };

  return mockData as unknown as T;
}









