"use client"

import { type ComponentPropsWithoutRef, useEffect, useRef } from "react"
import { useInView, useMotionValue, useSpring } from "motion/react"

import { cn } from "@/lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
  onAnimationStart?: () => void
  onAnimationComplete?: () => void
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  onAnimationStart,
  onAnimationComplete,
  ...props
}: NumberTickerProps) {
  const hasCompletedRef = useRef(false)
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === "down" ? value : startValue)
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })
  const isInView = useInView(ref, { once: true, margin: "0px" })

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value)
        onAnimationStart?.()
      }, delay * 1000)
      return () => clearTimeout(timer)
    }
  }, [motionValue, isInView, delay, value, direction, startValue, onAnimationStart])

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)))

          // Check if animation is complete (value is very close to target)
          const target = direction === "down" ? startValue : value
          if (!hasCompletedRef.current && Math.abs(latest - target) < 0.5) {
            hasCompletedRef.current = true
            onAnimationComplete?.()
          }
        }
      }),
    [springValue, decimalPlaces, value, startValue, direction, onAnimationComplete]
  )

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tracking-wider text-black tabular-nums dark:text-white",
        className
      )}
      {...props}
    >
      {startValue}
    </span>
  )
}
