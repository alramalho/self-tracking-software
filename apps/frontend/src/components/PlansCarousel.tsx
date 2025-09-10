import { EmblaOptionsType } from 'embla-carousel'
import AutoHeight from 'embla-carousel-auto-height'
import useEmblaCarousel from 'embla-carousel-react'
import React, { useCallback, useEffect, useState } from 'react'

type PropType = {
  children: React.ReactNode
  options?: EmblaOptionsType
}

const PlansCarousel: React.FC<PropType> = (props) => {
  const { children, options } = props
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    ...options
  }, [AutoHeight()])
  
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  const updateScrollSnapState = useCallback(() => {
    if (!emblaApi) return
    setScrollSnaps(emblaApi.scrollSnapList())
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    updateScrollSnapState()
    emblaApi.on('select', updateScrollSnapState)
    emblaApi.on('reInit', updateScrollSnapState)
  }, [emblaApi, updateScrollSnapState])

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index)
  }, [emblaApi])

  return (
    <section className="embla">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container flex gap-2 ">
          {children}
        </div>
      </div>
      
      {scrollSnaps.length > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                index === selectedIndex 
                  ? 'bg-gray-600' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              onClick={() => scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default PlansCarousel