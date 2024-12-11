"use client"

import { motion } from "framer-motion"

interface SpinnerProps {
  size?: number
  color?: string
}

export function ClassicSpinner({ size = 40, color = "text-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.span
        className={`inline-block rounded-full border-4 border-t-transparent ${color}`}
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          ease: "linear",
          repeat: Infinity,
        }}
      />
    </div>
  )
}

export function PulsingDots({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="flex space-x-1" style={{ height: size }}>
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className={`inline-block rounded-full ${color}`}
          style={{ width: size / 4, height: size / 4 }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  )
}

export function BouncingBall({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.span
        className={`inline-block rounded-full ${color}`}
        style={{ width: size / 4, height: size / 4 }}
        animate={{
          y: [0, -size / 2, 0],
        }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}

export function CircularProgress({ size = 40, color = "stroke-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.svg
        className={`${color}`}
        viewBox="0 0 24 24"
        style={{ width: size, height: size }}
      >
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          strokeWidth="2"
          strokeDasharray="60"
          strokeDashoffset="60"
          animate={{
            strokeDashoffset: [60, 0],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </motion.svg>
    </div>
  )
}

export function FadingSquares({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div
      className="grid grid-cols-2 gap-1"
      style={{ width: size, height: size }}
    >
      {[0, 1, 2, 3].map((index) => (
        <motion.span
          key={index}
          className={`inline-block ${color}`}
          animate={{
            opacity: [1, 0.2, 1],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: index * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

export function RotatingSquares({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={index}
          className={`absolute ${color}`}
          style={{
            width: size / 3,
            height: size / 3,
            top: index < 2 ? 0 : size * (2/3),
            left: index % 2 === 0 ? 0 : size * (2/3),
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  )
}

export function FlippingSquare({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        className={`${color}`}
        style={{ width: size * 0.6, height: size * 0.6 }}
        animate={{
          rotateY: [0, 180, 360],
          scale: [1, 0.5, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  )
}

export function ExpandingCircle({ size = 40, color = "border-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        className={`rounded-full ${color} border-4`}
        style={{ width: size, height: size }}
        animate={{
          scale: [0, 1],
          opacity: [1, 0],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
    </div>
  )
}

export function DualRing({ size = 40, color = "border-primary border-t-transparent" }: SpinnerProps) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className={`absolute inset-0 rounded-full border-4 ${color}`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      <motion.div
        className={`absolute inset-0 rounded-full border-4 ${color}`}
        animate={{ rotate: -360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  )
}

export function ThinkingDots({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="flex space-x-1 items-center justify-center" style={{ height: size }}>
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className={`inline-block rounded-full ${color}`}
          style={{ width: size / 5, height: size / 5 }}
          animate={{
            y: [0, -size / 3, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  )
}

export function PulsingBrain({ size = 40, color = "text-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
        style={{ width: size, height: size }}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
      </motion.svg>
    </div>
  )
}

export function DataProcessing({ size = 40, color = "stroke-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={color}
        style={{ width: size, height: size }}
      >
        <motion.path
          d="M22 12h-4l-3 9L9 3l-3 9H2"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </svg>
    </div>
  )
}

export function NeuralNetwork({ size = 40, color = "stroke-primary fill-primary" }: SpinnerProps) {
  const nodePositions = [
    { cx: 4, cy: 4 },
    { cx: 20, cy: 4 },
    { cx: 4, cy: 20 },
    { cx: 20, cy: 20 },
    { cx: 12, cy: 12 },
  ]

  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={color}
        style={{ width: size, height: size }}
      >
        {nodePositions.map((node, index) => (
          <motion.circle
            key={index}
            cx={node.cx}
            cy={node.cy}
            r="2"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: index * 0.3,
            }}
          />
        ))}
        {nodePositions.flatMap((start, i) =>
          nodePositions.slice(i + 1).map((end, j) => (
            <motion.line
              key={`${i}-${j}`}
              x1={start.cx}
              y1={start.cy}
              x2={end.cx}
              y2={end.cy}
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: (i + j) * 0.2,
              }}
            />
          ))
        )}
      </svg>
    </div>
  )
}

export function OrbitingDots({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full ${color}`}
          style={{
            width: size / 5,
            height: size / 5,
          }}
          animate={{
            x: [0, size / 2, 0, -size / 2, 0],
            y: [-size / 2, 0, size / 2, 0, -size / 2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
            delay: index * 0.5,
          }}
        />
      ))}
    </div>
  )
}

export function ProgressBar({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="relative overflow-hidden" style={{ width: size, height: size / 5 }}>
      <motion.div
        className={`h-full ${color}`}
        animate={{
          x: [-size, 0],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  )
}

export function Hourglass({ size = 40, color = "border-primary" }: SpinnerProps) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className={`absolute inset-0 border-4 ${color}`}
        animate={{
          rotate: 180,
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <motion.div
          className={`absolute inset-x-0 bottom-0 ${color.replace('border', 'bg')}`}
          style={{ height: '40%' }}
          animate={{
            height: ['40%', '0%', '40%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </div>
  )
}

export function Typewriter({ size = 40, color = "bg-primary" }: SpinnerProps) {
  return (
    <div className="flex items-center space-x-1" style={{ height: size }}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`w-1 ${color}`}
          style={{ height: size / 2 }}
          animate={{
            scaleY: [1, 2, 1],
          }}
          transition={{
            duration: 0.75,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.15,
          }}
        />
      ))}
    </div>
  )
}

