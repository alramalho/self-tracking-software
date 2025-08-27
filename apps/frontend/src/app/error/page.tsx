import React from 'react';
import Link from 'next/link';

const ErrorPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-gray-800">
      <h1 className="text-4xl font-light mb-4">Oops!</h1>
      <p className="text-xl mb-8">Something went wrong.</p>
      <Link 
        href="/" 
        className="px-6 py-3 rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors duration-300"
      >
        Return Home
      </Link>
    </div>
  );
};

export default ErrorPage;