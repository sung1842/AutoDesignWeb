import type { ReactNode } from "react";

export const metadata = { title: "취향핏" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
