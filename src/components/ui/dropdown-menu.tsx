"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const DropdownMenu = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { open?: boolean; onOpenChange?: (open: boolean) => void }
>(({ className, children, open, onOpenChange, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(open || false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (open !== undefined) {
            setIsOpen(open)
        }
    }, [open])

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                onOpenChange?.(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [onOpenChange])

    return (
        <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    // @ts-ignore
                    return React.cloneElement(child, { isOpen, setIsOpen, onOpenChange })
                }
                return child
            })}
        </div>
    )
})
DropdownMenu.displayName = "DropdownMenu"

const DropdownMenuTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; isOpen?: boolean; setIsOpen?: (open: boolean) => void; onOpenChange?: (open: boolean) => void }
>(({ className, children, asChild, isOpen, setIsOpen, onOpenChange, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : "button"

    const handleClick = (e: React.MouseEvent) => {
        if (setIsOpen) {
            setIsOpen(!isOpen)
            onOpenChange?.(!isOpen)
        }
        // @ts-ignore
        props.onClick?.(e)
    }

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: handleClick,
            "data-state": isOpen ? "open" : "closed",
        })
    }

    return (
        <button
            ref={ref}
            onClick={handleClick}
            className={cn(className)}
            data-state={isOpen ? "open" : "closed"}
            {...props}
        >
            {children}
        </button>
    )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" | "center"; isOpen?: boolean }
>(({ className, align = "center", isOpen, ...props }, ref) => {
    if (!isOpen) return null

    return (
        <div
            ref={ref}
            className={cn(
                "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2",
                "mt-2",
                className
            )}
            {...props}
        />
    )
})
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                inset && "pl-8",
                className
            )}
            {...props}
        />
    )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
}
