"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export const AlertDialog = ({ children, open, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange && onOpenChange(false)}>
            <div onClick={(e) => e.stopPropagation()}>{children}</div>
        </div>
    )
}

export const AlertDialogContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full",
            className
        )}
        {...props}
    >
        {children}
    </div>
)

export const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-right", className)} {...props} />
)

export const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2", className)} {...props} />
)

export const AlertDialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className={cn("text-lg font-semibold", className)} {...props} />
)

export const AlertDialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
)

export const AlertDialogAction = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2", className)} {...props} />
)

export const AlertDialogCancel = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2", className)} {...props} />
)
