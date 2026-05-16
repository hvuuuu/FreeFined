import Link from "next/link";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-5 h-14">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 h-full">
        <p>&copy; 2026 Vuntra. All Rights Reserved.</p>
        {/* <nav aria-label="Footer navigation" className="flex items-center gap-4">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav> */}
      </div>
    </footer>
  );
}
