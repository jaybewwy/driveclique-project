import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * GooeyDock — a row of icon buttons with a liquid blob hover effect.
 *
 * Props
 *   items      Array of { icon, label, onClick }
 *   className  Extra classes on the outer wrapper
 */
export default function GooeyDock({ items, className }) {
  const [hovered, setHovered] = React.useState(null);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      {/* Hidden SVG filter — namespaced ID so multiple instances don't clash */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id="goo-nav-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 18 -7"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <TooltipProvider delayDuration={100}>
        <div className="relative flex gap-1">
          {items.map((item, i) => {
            const isHovered = hovered === i;

            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <motion.div
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    animate={{ scale: isHovered ? 1.2 : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="relative"
                  >
                    {/* Liquid blob — rendered behind the button via SVG goo filter */}
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/40"
                      style={{ filter: "url(#goo-nav-filter)" }}
                      animate={{
                        scale: isHovered ? 1.8 : 1,
                        opacity: isHovered ? 1 : 0,
                      }}
                      transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    />

                    {/* Icon button (not filtered, renders above the blob) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative rounded-full bg-background/80 backdrop-blur-xl text-zinc-400 hover:text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                      onClick={item.onClick}
                    >
                      <item.icon className="h-5 w-5" />
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
