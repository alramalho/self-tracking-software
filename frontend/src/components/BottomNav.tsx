import React from 'react';
import { Pencil, Eye } from 'lucide-react';

const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-lg">
      <div className="flex justify-around">
        <a href="/see" className="flex flex-col items-center p-2 text-gray-600 hover:text-blue-500">
          <Eye size={24} />
          <span className="text-xs mt-1">See</span>
        </a>
        <a href="/log" className="flex flex-col items-center p-2 text-gray-600 hover:text-blue-500">
          <Pencil size={24} />
          <span className="text-xs mt-1">Log</span>
        </a>
      </div>
    </nav>
  );
};

export default BottomNav;