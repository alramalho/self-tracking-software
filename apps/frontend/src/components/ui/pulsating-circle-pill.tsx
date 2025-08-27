"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const pillVariants = cva(
  "rounded-full",
  {
    variants: {
      variant: {
        yellow: "",
        red: "",
        green: "",
        blue: ""
      },
      size: {
        sm: "h-1.5 w-1.5",
        md: "h-2 w-2",
        lg: "h-2.5 w-2.5"
      }
    },
    defaultVariants: {
      variant: "yellow",
      size: "md"
    }
  }
)

const pulseVariants = cva(
  "absolute -inset-1 animate-ping rounded-full opacity-75",
  {
    variants: {
      variant: {
        yellow: "bg-yellow-400",
        red: "bg-red-400",
        green: "bg-green-400",
        blue: "bg-blue-400"
      }
    },
    defaultVariants: {
      variant: "yellow"
    }
  }
)

const dotVariants = cva(
  "relative flex items-center justify-center rounded-full",
  {
    variants: {
      variant: {
        yellow: "bg-yellow-500",
        red: "bg-red-500",
        green: "bg-green-500",
        blue: "bg-blue-500"
      }
    },
    defaultVariants: {
      variant: "yellow"
    }
  }
)

interface PulsatingCirclePillProps 
  extends Omit<React.HTMLAttributes<HTMLDivElement>, keyof VariantProps<typeof pillVariants>>,
    VariantProps<typeof pillVariants> {}

export function PulsatingCirclePill({ 
  variant,
  size,
  className,
  ...props 
}: PulsatingCirclePillProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      <div className={cn(pulseVariants({ variant }))} />
      <div className={cn(dotVariants({ variant }), pillVariants({ size }))} />
    </div>
  )
} 