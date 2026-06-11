"use client";

import { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <main
      className="flex flex-1 flex-col overflow-auto"
      style={{ backgroundColor: "var(--muted-bg)" }}
    >
      <div className="flex-1 p-6">{children}</div>
    </main>
  );
}
