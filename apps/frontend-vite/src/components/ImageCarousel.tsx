import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Image {
  url: string | null;
  sortOrder?: number;
}

interface ImageCarouselProps {
  images: Image[];
  className?: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  className = "",
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <img
        src={images[currentImageIndex].url || ""}
        alt={`Image ${currentImageIndex + 1}`}
        className="w-full h-full max-h-[400px] object-cover rounded-2xl"
      />

      {/* Image navigation */}
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx === currentImageIndex ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageCarousel;
