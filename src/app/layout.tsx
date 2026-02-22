import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nehal Doom: The Game",
  description: "A first-person shooter with funny sound effects",
  openGraph: {
    title: "Nehal Doom: The Game",
    description: "A first-person shooter with funny sound effects",
  },
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
