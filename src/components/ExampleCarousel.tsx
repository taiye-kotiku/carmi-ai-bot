"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronRight, ChevronLeft } from "lucide-react";

const CAROUSEL_IMAGES = [
  "/examples/carousel/1.png",
  "/examples/carousel/2.png",
  "/examples/carousel/3.png",
  "/examples/carousel/4.png",
  "/examples/carousel/5.png",
  "/examples/carousel/6.png",
];

export function ExampleCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? CAROUSEL_IMAGES.length - 1 : prev - 1
    );
  };

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-800/50">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {CAROUSEL_IMAGES.map((src, i) => (
          <div key={i} className="min-w-full flex-shrink-0 relative">
            <Image
              src={src}
              alt={`דוגמא קרוסלה ${i + 1} מתוך ${CAROUSEL_IMAGES.length}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 400px"
              priority={i === 0}
            />
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm rounded-full px-4 py-2">
        <button
          onClick={goToNext}
          className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          aria-label="תמונה הבאה"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="text-sm text-white font-medium min-w-[4rem] text-center">
          {currentIndex + 1}/{CAROUSEL_IMAGES.length}
        </span>
        <button
          onClick={goToPrev}
          className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          aria-label="תמונה קודמת"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
