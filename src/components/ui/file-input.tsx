"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type FileInputProps = Omit<React.ComponentProps<"input">, "type" | "value">

// Native file inputs render browser-locale text, so label and status are rendered by the app instead.
function FileInput({ className, onChange, multiple, disabled, id, ...props }: FileInputProps) {
  const t = useTranslations("Common")
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const [names, setNames] = React.useState<string[]>([])

  let status = t("fileInput.noFileSelected")
  if (names.length === 1) {
    status = names[0]
  } else if (names.length > 1) {
    status = t("fileInput.filesSelected", { count: names.length })
  }

  return (
    <div
      data-slot="file-input"
      className={cn(
        "border-input dark:bg-input/30 flex h-9 w-full min-w-0 items-center gap-2 rounded-md border bg-transparent px-1 text-sm shadow-xs",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <input
        {...props}
        id={inputId}
        type="file"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onChange?.(event)
          setNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))
        }}
      />
      <label
        htmlFor={inputId}
        className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-sm bg-secondary px-2 font-medium text-secondary-foreground hover:bg-secondary/80"
      >
        {multiple ? t("fileInput.chooseFiles") : t("fileInput.chooseFile")}
      </label>
      <span className="truncate text-muted-foreground">{status}</span>
    </div>
  )
}

export { FileInput }
