import { Terminal } from 'lucide-react';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <Terminal className="mr-2 h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Terminal 3D</span>
        </div>
        {/* Add navigation items here if needed */}
      </div>
    </header>
  );
}
