import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DOOM-Style FPS",
  description: "A first-person shooter with funny sound effects",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: "hidden", backgroundColor: "#000" }}>
        {children}
      </body>
    </html>
  );
}
