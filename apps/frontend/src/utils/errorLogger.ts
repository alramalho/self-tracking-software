export const logGlobalError = async (error: Error, url?: string) => {
  try {
    const errorData = {
      message: error.message,
      stack: error.stack,
      url: url || (typeof window !== 'undefined' ? window.location.href : undefined),
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    };

    // Send to your error logging API endpoint
    await fetch('/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData),
    });
  } catch (logError) {
    // Fallback to console if API fails
    console.error('Failed to log error to API:', logError);
    console.error('Original error:', error);
  }
};