"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group peer relative inline-flex h-6 w-16 shrink-0 items-center rounded-full border border-transparent bg-input outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary dark:bg-input/80",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 text-[0.6rem] font-bold tracking-wide text-primary-foreground opacity-0 transition-opacity group-data-[checked]:opacity-100">
        AN
      </span>
      <span className="pointer-events-none absolute right-2 text-[0.6rem] font-bold tracking-wide text-muted-foreground opacity-100 transition-opacity group-data-[checked]:opacity-0">
        AUS
      </span>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none relative z-10 block size-5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform group-data-[checked]:translate-x-[2.5rem]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
