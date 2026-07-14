"use client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const githubUrl = "https://github.com/hvuuuu";

export function Header({ onReset }: { onReset?: () => void }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 h-14">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-full">
        <Link href="/" className="flex items-center gap-2" onClick={onReset}>
          <Image
            src="/logo.ico"
            alt="FreeFined"
            width={32}
            height={32}
            className="rounded-md"
          />
          <span className="bg-linear-to-r from-red-500 to-rose-500 bg-clip-text text-lg font-bold tracking-tight text-transparent">
            FreeFined
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="View on GitHub"
            className="cursor-pointer"
          >
            <Link href={githubUrl} target="_blank" rel="noopener noreferrer">
              <Github className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
