import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';

export default function ResumeUploadCard() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [errorMsg, setErrorMsg] = useState('');
  const [processingTime, setProcessingTime] = useState(0);
  const [questionsCount, setQuestionsCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      setErrorMsg('Please upload a PDF file');
      return;
    }

    // Validate file size (5MB max)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setErrorMsg('');
    setStatus('idle');
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg('Please select a file');
      return;
    }

    setLoading(true);
    setStatus('uploading');
    setErrorMsg('');

    try {
      // Get auth token
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Not authenticated. Please login first.');
      }

      // Upload resume
      const formData = new FormData();
      formData.append('resume', file);

      const uploadResponse = await fetch('/api/resume/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.message || 'Upload failed');
      }

      const uploadData = await uploadResponse.json();
      setSessionId(uploadData.sessionId);
      setStatus('processing');

      // Poll for status
      pollProcessingStatus(uploadData.sessionId, token);
    } catch (error) {
      setErrorMsg(error.message);
      setStatus('error');
      setLoading(false);
    }
  };

  const pollProcessingStatus = async (sId, token, maxAttempts = 60) => {
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setErrorMsg('Processing timeout. Please try again.');
        setStatus('error');
        setLoading(false);
        return;
      }

      try {
        const statusResponse = await fetch(`/api/resume/status/${sId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!statusResponse.ok) {
          throw new Error('Failed to fetch status');
        }

        const statusData = await statusResponse.json();

        if (statusData.status === 'completed') {
          setQuestionsCount(statusData.totalQuestions);
          setProcessingTime(statusData.processingTime);
          setStatus('completed');
          setLoading(false);
        } else if (statusData.status === 'failed') {
          setErrorMsg(statusData.errorMessage);
          setStatus('error');
          setLoading(false);
        } else {
          // Still processing
          attempts++;
          setTimeout(poll, 2000); // Check every 2 seconds
        }
      } catch (error) {
        setErrorMsg('Error checking status: ' + error.message);
        setStatus('error');
        setLoading(false);
      }
    };

    poll();
  };

  const handleViewQuestions = () => {
    if (sessionId) {
      // Navigate to questions page
      window.location.href = `/dashboard/questions/${sessionId}`;
    }
  };

  const handleDownload = async () => {
    if (!sessionId) return;

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

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview-questions-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setErrorMsg('Download failed: ' + error.message);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSessionId(null);
    setStatus('idle');
    setErrorMsg('');
    setProcessingTime(0);
    setQuestionsCount(0);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Upload Your Resume
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Get personalized interview questions based on your skills and experience
          </p>
        </div>

        {/* File Upload Area */}
        {status === 'idle' && (
          <div className="mb-6">
            <label
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center w-full p-8 border-2 border-dashed border-blue-400 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-center">
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  PDF files up to 5MB
                </p>
              </div>
            </label>

            {file && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-slate-700 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  📄 {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            {errorMsg && status === 'idle' && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-200">{errorMsg}</p>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full mt-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Processing...' : 'Upload and Process'}
            </button>
          </div>
        )}

        {/* Processing Status */}
        {status === 'uploading' && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Uploading your resume...
            </p>
          </div>
        )}

        {status === 'processing' && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Processing your resume...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Extracting skills and generating interview questions
            </p>
          </div>
        )}

        {/* Completed Status */}
        {status === 'completed' && (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Success! 🎉
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Generated {questionsCount} personalized interview questions
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Processing time: {(processingTime / 1000).toFixed(1)}s
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleViewQuestions}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                View Questions
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download JSON
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-600 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-medium rounded-lg transition"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}

        {/* Error Status */}
        {status === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
            <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Processing Failed
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              {errorMsg}
            </p>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-slate-700 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          ℹ️ How it works:
        </h3>
        <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
          <li>Upload your resume (PDF format)</li>
          <li>Our AI extracts your skills and experience</li>
          <li>We generate personalized interview questions</li>
          <li>Practice and prepare with relevant questions</li>
        </ol>
      </div>
    </div>
  );
}
