"use client";

import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";

const variantClasses: Record<string, string> = {
	primary: "bg-primary text-white hover:bg-primary-hover",
	secondary: "bg-secondary text-primary hover:bg-secondary-hover",
	danger: "bg-danger text-white hover:bg-red-700",
	ghost: "bg-transparent text-muted hover:bg-gray-100",
	outline: "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50",
};

const sizeClasses: Record<string, string> = {
	sm: "px-3 py-1.5 text-sm",
	md: "px-4 py-2 text-sm",
	lg: "px-6 py-3 text-base",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
	size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ variant = "primary", size = "md", className, children, ...props }, ref) => {
		return (
			<button
				ref={ref}
				className={cn(
					"inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
					variantClasses[variant],
					sizeClasses[size],
					className,
				)}
				{...props}
			>
				{children}
			</button>
		);
	},
);

Button.displayName = "Button";

export type { ButtonProps };
export { Button };
