"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface SafeMotionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

// 1. FADE IN & SLIGHT TRANSLATE UP (FOR SECTIONS)
export function FadeIn({ children, className, delay = 0 }: SafeMotionProps) {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 8,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: "easeOut" as any,
        delay,
      },
    },
  } as any;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 2. GENTLE SCALE HOVER (FOR BUTTONS, SELECTORS)
export function ScaleHover({ children, className }: SafeMotionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? {} : { scale: 1.015 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.985 }}
      transition={{ duration: 0.15, ease: "easeInOut" as any }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 3. CARD HOVER LIFT (FOR WORKSPACE CARDS, ACTION CARDS)
export function CardLift({ children, className }: SafeMotionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={
        shouldReduceMotion
          ? {}
          : {
              y: -3,
              boxShadow: "0 12px 20px -8px rgba(var(--accent-rgb, 255, 107, 0), 0.15)",
            }
      }
      transition={{ duration: 0.2, ease: "easeOut" as any }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 4. DROPDOWN ENTRANCE TRANSITION
export function DropdownEntrance({ children, className }: SafeMotionProps) {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -6,
      scale: shouldReduceMotion ? 1 : 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.2,
        ease: "easeOut" as any,
      },
    },
  } as any;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 5. MODAL / DIALOG ENTRANCE
export function ModalEntrance({ children, className }: SafeMotionProps) {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.96,
      y: shouldReduceMotion ? 0 : 15,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.25,
        ease: "easeOut" as any,
      },
    },
  } as any;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
