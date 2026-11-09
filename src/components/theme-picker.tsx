"use client"

import * as React from "react"
import { Check, Leaf, Moon, Palette, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setMeadow, useMeadow } from "@/lib/scene"

type Choice = "light" | "dark" | "meadow"

/** Keeps the Meadow theme on top of the dark one, whatever else changes the theme. */
export function SceneSync() {
  const { theme, setTheme } = useTheme()
  const meadow = useMeadow()

  React.useEffect(() => {
    if (meadow && theme !== "dark") setTheme("dark")
  }, [meadow, theme, setTheme])

  return null
}

export function ThemePicker() {
  const { resolvedTheme, setTheme } = useTheme()
  const meadow = useMeadow()
  const current: Choice = meadow ? "meadow" : resolvedTheme === "dark" ? "dark" : "light"

  function choose(choice: Choice) {
    setMeadow(choice === "meadow")
    setTheme(choice === "light" ? "light" : "dark")
  }

  const options: { value: Choice; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun /> },
    { value: "dark", label: "Dark", icon: <Moon /> },
    { value: "meadow", label: "Meadow", icon: <Leaf /> },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Change theme">
            <Palette />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => choose(option.value)}>
            {option.icon}
            <span className="flex-1">{option.label}</span>
            {current === option.value ? <Check /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
