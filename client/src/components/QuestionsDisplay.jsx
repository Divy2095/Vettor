import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  ArrowLeft,
} from 'lucide-react';

export default function QuestionsDisplay() {
  const { sessionId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    difficulty: null,
    topic: null,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [skills, setSkills] = useState({
    extracted: [],
    expanded: [],
  });

  useEffect(() => {
    fetchQuestions();
  }, [filters, pagination.page]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      // Build query params
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.topic && { topic: filters.topic }),
      });

      const response = await fetch(
        `/api/resume/questions/${sessionId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch questions');
      }

      const data = await response.json();
      setQuestions(data.questions);
      setPagination(data.pagination);
      setSkills(data.skills);
      setError('');
    } catch (err) {
      setError(err.message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (type, value) => {
    setFilters((prev) => ({
      ...prev,
      [type]: prev[type] === value ? null : value,
    }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/resume/questions/${sessionId}/export`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview-questions-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Hard':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (loading && questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 dark:bg-red-900 p-6 rounded-lg">
          <p className="text-red-700 dark:text-red-200">Error: {error}</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Your Interview Questions
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {pagination.total} personalized questions based on your profile
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
          </div>
        </div>

        {/* Skills Summary */}
        {skills.extracted.length > 0 && (
          <div className="mb-8 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Your Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {skills.extracted.slice(0, 10).map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
              {skills.extracted.length > 10 && (
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm">
                  +{skills.extracted.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
          </div>

          <div className="flex gap-4 flex-wrap">
            {/* Difficulty Filter */}
            <div>
              <label className="text-sm text-gray-700 dark:text-gray-300 block mb-2">
                Difficulty
              </label>
              <div className="flex gap-2">
                {['Easy', 'Medium', 'Hard'].map((level) => (
                  <button
                    key={level}
                    onClick={() => handleFilterChange('difficulty', level)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      filters.difficulty === level
                        ? getDifficultyColor(level)
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Filter */}
            <div>
              <label className="text-sm text-gray-700 dark:text-gray-300 block mb-2">
                Topic
              </label>
              <select
                value={filters.topic || ''}
                onChange={(e) =>
                  handleFilterChange('topic', e.target.value || null)
                }
                className="px-3 py-1 rounded-lg text-sm bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                <option value="">All Topics</option>
                <option value="DSA">DSA</option>
                <option value="Python">Python</option>
                <option value="JavaScript">JavaScript</option>
                <option value="HTML">HTML/CSS</option>
                <option value="OS">Operating Systems</option>
                <option value="Database">Database</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4 mb-8">
          {questions.map((question, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md transition overflow-hidden"
            >
              {/* Question Header */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === idx ? null : idx)
                }
                className="w-full p-4 flex items-start gap-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                {/* Question Number */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-semibold text-blue-700 dark:text-blue-200">
                    {question.sr_no}
                  </div>
                </div>

                {/* Question Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white font-medium line-clamp-2">
                    {question.question}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${getDifficultyColor(
                        question.difficulty
                      )}`}
                    >
                      {question.difficulty}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full">
                      {question.topic}
                    </span>
                    <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                      Score: {(question.final_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Expand Icon */}
                <div className="flex-shrink-0">
                  {expandedId === idx ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {expandedId === idx && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-4 bg-gray-50 dark:bg-slate-700">
                  <p className="text-gray-700 dark:text-gray-200 mb-4 leading-relaxed">
                    {question.question}
                  </p>

                  {/* Tags */}
                  {question.tags && question.tags.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tags:
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {question.tags.map((tag, tagIdx) => (
                          <span
                            key={tagIdx}
                            className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded">
                      <p className="text-gray-600 dark:text-gray-400">Semantic Score</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {(question.score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-800 rounded">
                      <p className="text-gray-600 dark:text-gray-400">Tag Score</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {(question.tag_score * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              disabled={pagination.page === 1}
              className="px-4 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg disabled:opacity-50"
            >
              Previous
            </button>

            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page }))
                  }
                  className={`px-3 py-2 rounded-lg ${
                    pagination.page === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white'
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.min(prev.pages, prev.page + 1),
                }))
              }
              disabled={pagination.page === pagination.pages}
              className="px-4 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
